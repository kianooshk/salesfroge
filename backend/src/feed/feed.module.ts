import { Body, Controller, Delete, Get, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../common/notifications.service';
import { AuthUser, CurrentUser } from '../common/decorators';
import { mentionDisplay, parseMentionIds } from '../common/mentions';

const authorSelect = { select: { id: true, firstName: true, lastName: true, avatarColor: true, email: true } };

@Injectable()
export class FeedService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  private async mention(actor: AuthUser, body: string, link: string) {
    const ids = parseMentionIds(body);
    const text = mentionDisplay(body).slice(0, 140);
    await Promise.all(
      ids
        .filter((id) => id !== actor.id)
        .map((id) =>
          this.notifications.notify(id, 'mention', `${actor.firstName} ${actor.lastName} mentioned you: ${text}`, link),
        ),
    );
  }

  list(query: { relatedType?: string; relatedId?: string }) {
    const where =
      query.relatedType && query.relatedId
        ? { relatedType: query.relatedType, relatedId: query.relatedId }
        : query.relatedType === 'company' || (!query.relatedType && !query.relatedId)
          ? { relatedType: null }
          : {};
    return this.prisma.feedItem.findMany({
      where,
      include: {
        author: authorSelect,
        comments: { include: { author: authorSelect }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async post(user: AuthUser, input: any) {
    const item = await this.prisma.feedItem.create({
      data: {
        body: input.body || '',
        authorId: user.id,
        relatedType: input.relatedType || null,
        relatedId: input.relatedId || null,
      },
      include: { author: authorSelect, comments: true },
    });
    const link = input.relatedType ? `/o/${input.relatedType.toLowerCase()}s/${input.relatedId}` : '/feed';
    await this.mention(user, input.body || '', link);
    return item;
  }

  async comment(user: AuthUser, feedItemId: string, body: string) {
    const comment = await this.prisma.feedComment.create({
      data: { feedItemId, authorId: user.id, body: body || '' },
      include: { author: authorSelect, feedItem: true },
    });
    if (comment.feedItem.authorId !== user.id) {
      await this.notifications.notify(
        comment.feedItem.authorId,
        'comment',
        `${user.firstName} ${user.lastName} commented on your post`,
        '/feed',
      );
    }
    await this.mention(user, body || '', '/feed');
    return comment;
  }

  async remove(user: AuthUser, id: string) {
    const item = await this.prisma.feedItem.findUnique({ where: { id } });
    if (!item) return { success: true };
    if (item.authorId !== user.id && !user.isAdmin) {
      return { success: false };
    }
    await this.prisma.feedItem.delete({ where: { id } });
    return { success: true };
  }

  listNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
    return { success: true };
  }
}

@Controller('feed')
export class FeedController {
  constructor(private feed: FeedService) {}

  @Get()
  list(@Query() query: any) {
    return this.feed.list(query);
  }

  @Post()
  post(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.feed.post(user, body);
  }

  @Post(':id/comments')
  comment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    return this.feed.comment(user, id, body.body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.feed.remove(user, id);
  }
}

@Controller('notifications')
export class NotificationsController {
  constructor(private feed: FeedService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.feed.listNotifications(user.id);
  }

  @Post('read-all')
  readAll(@CurrentUser() user: AuthUser) {
    return this.feed.markAllRead(user.id);
  }

  @Post(':id/read')
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.feed.markRead(user.id, id);
  }
}

@Module({
  controllers: [FeedController, NotificationsController],
  providers: [FeedService],
  exports: [FeedService],
})
export class FeedModule {}
