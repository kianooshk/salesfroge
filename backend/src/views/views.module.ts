import { Body, Controller, Delete, ForbiddenException, Get, Injectable, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, CurrentUser } from '../common/decorators';

@Injectable()
export class ViewsService {
  constructor(private prisma: PrismaService) {}

  list(user: AuthUser, objectType?: string) {
    return this.prisma.listView.findMany({
      where: {
        objectType: objectType || undefined,
        OR: [{ ownerId: user.id }, { isShared: true }],
      },
      orderBy: { name: 'asc' },
    });
  }

  create(user: AuthUser, input: any) {
    return this.prisma.listView.create({
      data: {
        name: input.name || 'Untitled view',
        objectType: input.objectType,
        filters: input.filters || [],
        columns: input.columns || [],
        sortBy: input.sortBy || null,
        sortDir: input.sortDir || 'asc',
        isShared: !!input.isShared,
        ownerId: user.id,
      },
    });
  }

  async update(user: AuthUser, id: string, input: any) {
    const view = await this.prisma.listView.findUnique({ where: { id } });
    if (!view) throw new ForbiddenException();
    if (view.ownerId !== user.id && !user.isAdmin) throw new ForbiddenException('You can only edit your own views');
    const data: any = {};
    for (const key of ['name', 'filters', 'columns', 'sortBy', 'sortDir', 'isShared']) {
      if (input[key] !== undefined) data[key] = input[key];
    }
    return this.prisma.listView.update({ where: { id }, data });
  }

  async remove(user: AuthUser, id: string) {
    const view = await this.prisma.listView.findUnique({ where: { id } });
    if (!view) return { success: true };
    if (view.ownerId !== user.id && !user.isAdmin) throw new ForbiddenException('You can only delete your own views');
    await this.prisma.listView.delete({ where: { id } });
    return { success: true };
  }
}

@Controller('views')
export class ViewsController {
  constructor(private views: ViewsService) {}

  @Get() list(@CurrentUser() user: AuthUser, @Query('objectType') objectType?: string) { return this.views.list(user, objectType); }
  @Post() create(@CurrentUser() user: AuthUser, @Body() body: any) { return this.views.create(user, body); }
  @Patch(':id') update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) { return this.views.update(user, id, body); }
  @Delete(':id') remove(@CurrentUser() user: AuthUser, @Param('id') id: string) { return this.views.remove(user, id); }
}

@Module({ controllers: [ViewsController], providers: [ViewsService] })
export class ViewsModule {}
