import { Controller, Module, Get, Post, Patch, Delete, Param, Body, Query, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SharingService } from '../common/sharing.service';
import { CurrentUser, AuthUser } from '../common/decorators';

const OBJECT = 'Account';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService, private sharing: SharingService) {}

  async findAll(user: AuthUser, query: { search?: string; type?: string; ownerId?: string }) {
    const scope = await this.sharing.readScope(user, OBJECT);
    const where: any = { AND: [scope] };
    if (query.type) where.AND.push({ type: query.type });
    if (query.ownerId) where.AND.push({ ownerId: query.ownerId });
    if (query.search) {
      where.AND.push({
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { industry: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }
    return this.prisma.account.findMany({
      where,
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, avatarColor: true } },
        _count: { select: { contacts: true, opportunities: true, cases: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(user: AuthUser, id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, avatarColor: true } },
        contacts: { include: { owner: { select: { firstName: true, lastName: true } } } },
        opportunities: { orderBy: { createdAt: 'desc' } },
        cases: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async create(user: AuthUser, data: any) {
    return this.prisma.account.create({ data: { ...data, ownerId: data.ownerId || user.id } });
  }

  async update(user: AuthUser, id: string, data: any) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');
    if (!(await this.sharing.canEditRecord(user, OBJECT, id, account.ownerId)))
      throw new ForbiddenException('You cannot edit this account');
    return this.prisma.account.update({ where: { id }, data });
  }

  async remove(user: AuthUser, id: string) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');
    if (!(await this.sharing.canEditRecord(user, OBJECT, id, account.ownerId)))
      throw new ForbiddenException('You cannot delete this account');
    await this.prisma.account.delete({ where: { id } });
    return { success: true };
  }
}

@Controller('accounts')
export class AccountsController {
  constructor(private accounts: AccountsService) {}

  @Get() findAll(@CurrentUser() u: AuthUser, @Query() q: any) { return this.accounts.findAll(u, q); }
  @Get(':id') findOne(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.accounts.findOne(u, id); }
  @Post() create(@CurrentUser() u: AuthUser, @Body() b: any) { return this.accounts.create(u, b); }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: any) { return this.accounts.update(u, id, b); }
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.accounts.remove(u, id); }
}

@Module({ providers: [AccountsService], controllers: [AccountsController], exports: [AccountsService] })
export class AccountsModule {}
