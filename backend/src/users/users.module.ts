import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, CurrentUser } from '../common/decorators';

const AVATAR_COLORS = ['#1b5f8c', '#0b827c', '#9050e9', '#b60554', '#ba0517', '#e07c00', '#0176d3'];
const publicUser = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  title: true,
  phone: true,
  avatarColor: true,
  isActive: true,
  isAdmin: true,
  roleId: true,
  role: { select: { id: true, name: true } },
  createdAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private assertAdmin(user: AuthUser) {
    if (!user.isAdmin) throw new ForbiddenException('Administrator access is required');
  }

  list() {
    return this.prisma.user.findMany({ select: publicUser, orderBy: { firstName: 'asc' } });
  }

  async create(actor: AuthUser, input: any) {
    this.assertAdmin(actor);
    if (!input.email || !input.password || !input.firstName || !input.lastName) {
      throw new BadRequestException('email, password, firstName and lastName are required');
    }
    const password = await bcrypt.hash(input.password, 10);
    return this.prisma.user.create({
      data: {
        email: String(input.email).toLowerCase(),
        password,
        firstName: input.firstName,
        lastName: input.lastName,
        title: input.title || null,
        phone: input.phone || null,
        roleId: input.roleId || null,
        isAdmin: !!input.isAdmin,
        isActive: input.isActive !== false,
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      },
      select: publicUser,
    });
  }

  async update(actor: AuthUser, id: string, input: any) {
    if (!actor.isAdmin && actor.id !== id) throw new ForbiddenException();
    const data: any = {};
    for (const key of ['firstName', 'lastName', 'title', 'phone']) {
      if (input[key] !== undefined) data[key] = input[key];
    }
    if (actor.isAdmin) {
      if (input.roleId !== undefined) data.roleId = input.roleId || null;
      if (input.isAdmin !== undefined) data.isAdmin = !!input.isAdmin;
      if (input.isActive !== undefined) data.isActive = !!input.isActive;
      if (input.email) data.email = String(input.email).toLowerCase();
    }
    if (input.password) data.password = await bcrypt.hash(input.password, 10);
    return this.prisma.user.update({ where: { id }, data, select: publicUser });
  }

  listRoles() {
    return this.prisma.role.findMany({
      include: { parent: { select: { id: true, name: true } }, _count: { select: { users: true, children: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createRole(actor: AuthUser, input: any) {
    this.assertAdmin(actor);
    if (!input.name) throw new BadRequestException('name is required');
    return this.prisma.role.create({
      data: {
        name: input.name,
        description: input.description || null,
        parentId: input.parentId || null,
        permissions: input.permissions || {},
      },
    });
  }

  async updateRole(actor: AuthUser, id: string, input: any) {
    this.assertAdmin(actor);
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.parentId !== undefined) data.parentId = input.parentId || null;
    if (input.permissions !== undefined) data.permissions = input.permissions;
    if (data.parentId === id) throw new BadRequestException('A role cannot be its own parent');
    return this.prisma.role.update({ where: { id }, data });
  }

  async removeRole(actor: AuthUser, id: string) {
    this.assertAdmin(actor);
    await this.prisma.role.delete({ where: { id } });
    return { success: true };
  }

  listTeams() {
    return this.prisma.team.findMany({
      include: {
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, avatarColor: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createTeam(actor: AuthUser, input: any) {
    this.assertAdmin(actor);
    if (!input.name) throw new BadRequestException('name is required');
    return this.prisma.team.create({
      data: {
        name: input.name,
        description: input.description || null,
        members: input.members?.length
          ? { create: input.members.map((member: any) => ({ userId: member.userId, role: member.role || 'member' })) }
          : undefined,
      },
      include: { members: true },
    });
  }

  async updateTeam(actor: AuthUser, id: string, input: any) {
    this.assertAdmin(actor);
    return this.prisma.team.update({
      where: { id },
      data: { name: input.name, description: input.description },
    });
  }

  async removeTeam(actor: AuthUser, id: string) {
    this.assertAdmin(actor);
    await this.prisma.team.delete({ where: { id } });
    return { success: true };
  }

  async addMember(actor: AuthUser, teamId: string, input: any) {
    this.assertAdmin(actor);
    if (!input.userId) throw new BadRequestException('userId is required');
    return this.prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId: input.userId } },
      update: { role: input.role || 'member' },
      create: { teamId, userId: input.userId, role: input.role || 'member' },
    });
  }

  async removeMember(actor: AuthUser, teamId: string, userId: string) {
    this.assertAdmin(actor);
    await this.prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
    return { success: true };
  }

  listShares(recordType?: string, recordId?: string) {
    return this.prisma.share.findMany({
      where: { recordType: recordType || undefined, recordId: recordId || undefined },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createShare(input: any) {
    if (!input.recordType || !input.recordId) throw new BadRequestException('recordType and recordId are required');
    if (!input.userId && !input.teamId) throw new BadRequestException('userId or teamId is required');
    return this.prisma.share.create({
      data: {
        recordType: input.recordType,
        recordId: input.recordId,
        access: input.access === 'edit' ? 'edit' : 'read',
        userId: input.userId || null,
        teamId: input.teamId || null,
      },
    });
  }

  async removeShare(id: string) {
    await this.prisma.share.delete({ where: { id } });
    return { success: true };
  }
}

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.users.create(user, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.users.update(user, id, body);
  }
}

@Controller('roles')
export class RolesController {
  constructor(private users: UsersService) {}

  @Get() list() { return this.users.listRoles(); }
  @Post() create(@CurrentUser() user: AuthUser, @Body() body: any) { return this.users.createRole(user, body); }
  @Patch(':id') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) { return this.users.updateRole(user, id, body); }
  @Delete(':id') remove(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.users.removeRole(user, id); }
}

@Controller('teams')
export class TeamsController {
  constructor(private users: UsersService) {}

  @Get() list() { return this.users.listTeams(); }
  @Post() create(@CurrentUser() user: AuthUser, @Body() body: any) { return this.users.createTeam(user, body); }
  @Patch(':id') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) { return this.users.updateTeam(user, id, body); }
  @Delete(':id') remove(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.users.removeTeam(user, id); }
  @Post(':id/members') addMember(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) { return this.users.addMember(user, id, body); }
  @Delete(':id/members/:userId') removeMember(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('userId') userId: string) { return this.users.removeMember(user, id, userId); }
}

@Controller('shares')
export class SharesController {
  constructor(private users: UsersService) {}

  @Get()
  list(@Query('recordType') recordType?: string, @Query('recordId') recordId?: string) {
    return this.users.listShares(recordType, recordId);
  }

  @Post()
  create(@Body() body: any) {
    return this.users.createShare(body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.users.removeShare(id);
  }
}

@Module({
  controllers: [UsersController, RolesController, TeamsController, SharesController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
