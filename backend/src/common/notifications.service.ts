import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  notify(userId: string | null | undefined, type: string, message: string, link?: string) {
    if (!userId) return Promise.resolve(null);
    return this.prisma.notification.create({
      data: { userId, type, message, link },
    });
  }
}
