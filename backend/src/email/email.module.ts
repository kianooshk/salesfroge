import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, CurrentUser } from '../common/decorators';
import { mergeTemplate, recordContext } from '../common/data';
import { OBJECT_BY_API } from '../metadata/object-meta';

@Injectable()
export class EmailService {
  constructor(private prisma: PrismaService) {}

  status() {
    return {
      smtp: !!process.env.SMTP_HOST,
      imap: !!process.env.IMAP_HOST,
      from: process.env.SMTP_FROM || null,
    };
  }

  list(query: { relatedType?: string; relatedId?: string }) {
    return this.prisma.emailMessage.findMany({
      where: {
        relatedType: query.relatedType || undefined,
        relatedId: query.relatedId || undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { firstName: true, lastName: true } } },
    });
  }

  templates() {
    return this.prisma.emailTemplate.findMany({ orderBy: { name: 'asc' } });
  }

  createTemplate(user: AuthUser, input: any) {
    return this.prisma.emailTemplate.create({
      data: {
        name: input.name,
        subject: input.subject || '',
        body: input.body || '',
        createdById: user.id,
      },
    });
  }

  updateTemplate(id: string, input: any) {
    const data: any = {};
    for (const key of ['name', 'subject', 'body']) if (input[key] !== undefined) data[key] = input[key];
    return this.prisma.emailTemplate.update({ where: { id }, data });
  }

  async removeTemplate(id: string) {
    await this.prisma.emailTemplate.delete({ where: { id } });
    return { success: true };
  }

  private async loadRelated(type?: string, id?: string) {
    if (!type || !id) return null;
    const config = OBJECT_BY_API[type];
    if (!config) return null;
    return (this.prisma as any)[config.model].findUnique({
      where: { id },
      include: { owner: true, account: true, contact: true },
    }).catch(() => (this.prisma as any)[config.model].findUnique({ where: { id } }));
  }

  async send(user: AuthUser, input: any) {
    if (!input.to) throw new BadRequestException('A recipient is required');
    let subject = input.subject || '';
    let body = input.body || '';
    if (input.templateId) {
      const template = await this.prisma.emailTemplate.findUnique({ where: { id: input.templateId } });
      if (template) {
        subject = input.subject || template.subject;
        body = input.body || template.body;
      }
    }
    const related = await this.loadRelated(input.relatedType, input.relatedId);
    const context = recordContext(related);
    subject = mergeTemplate(subject, context);
    body = mergeTemplate(body, context);

    let status = 'logged';
    let messageId: string | null = null;
    let warning: string | null = null;
    if (!process.env.SMTP_HOST) {
      warning = 'SMTP is not configured. The message was logged on the record but not delivered.';
    } else {
      try {
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
            : undefined,
        });
        const info = await transport.sendMail({
          from: process.env.SMTP_FROM || user.email,
          to: input.to,
          cc: input.cc || undefined,
          subject,
          text: body,
        });
        status = 'sent';
        messageId = info.messageId || null;
      } catch (error: any) {
        status = 'failed';
        warning = error?.message || 'SMTP send failed';
      }
    }

    const saved = await this.prisma.emailMessage.create({
      data: {
        direction: 'outbound',
        fromAddress: process.env.SMTP_FROM || user.email,
        toAddresses: input.to,
        ccAddresses: input.cc || null,
        subject,
        body,
        status,
        relatedType: input.relatedType || null,
        relatedId: input.relatedId || null,
        userId: user.id,
        templateId: input.templateId || null,
        messageId,
        sentAt: status === 'sent' ? new Date() : null,
      },
    });
    return { ...saved, warning };
  }

  async syncInbound(user: AuthUser) {
    if (!process.env.IMAP_HOST || !process.env.IMAP_USER) {
      return { configured: false, imported: 0, message: 'IMAP is not configured. Set IMAP_HOST, IMAP_USER and IMAP_PASSWORD.' };
    }
    const { ImapFlow } = await import('imapflow');
    const { simpleParser } = await import('mailparser');
    const client = new ImapFlow({
      host: process.env.IMAP_HOST,
      port: Number(process.env.IMAP_PORT || 993),
      secure: process.env.IMAP_SECURE !== 'false',
      auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASSWORD || '' },
    });
    let imported = 0;
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      for await (const message of client.fetch({ since }, { source: true, envelope: true })) {
        const parsed: any = await simpleParser(message.source as Buffer);
        const messageId = parsed.messageId || message.envelope?.messageId;
        if (messageId) {
          const existing = await this.prisma.emailMessage.findFirst({ where: { messageId } });
          if (existing) continue;
        }
        const from = parsed.from?.value?.[0]?.address || message.envelope?.from?.[0]?.address || '';
        const contact = from ? await this.prisma.contact.findFirst({ where: { email: { equals: from, mode: 'insensitive' } } }) : null;
        const lead = !contact && from
          ? await this.prisma.lead.findFirst({ where: { email: { equals: from, mode: 'insensitive' }, isConverted: false } })
          : null;
        await this.prisma.emailMessage.create({
          data: {
            direction: 'inbound',
            fromAddress: from,
            toAddresses: (parsed.to?.value || []).map((item: any) => item.address).join(', '),
            subject: parsed.subject || '(no subject)',
            body: parsed.text || '',
            status: 'received',
            relatedType: contact ? 'Contact' : lead ? 'Lead' : null,
            relatedId: contact?.id || lead?.id || null,
            userId: user.id,
            messageId: messageId || null,
            sentAt: parsed.date || new Date(),
          },
        });
        imported += 1;
        if (imported >= 50) break;
      }
    } finally {
      lock.release();
      await client.logout();
    }
    return { configured: true, imported };
  }
}

@Controller('email')
export class EmailController {
  constructor(private email: EmailService) {}

  @Get('status') status() { return this.email.status(); }
  @Get('templates') templates() { return this.email.templates(); }
  @Post('templates') createTemplate(@CurrentUser() user: AuthUser, @Body() body: any) { return this.email.createTemplate(user, body); }
  @Patch('templates/:id') updateTemplate(@Param('id') id: string, @Body() body: any) { return this.email.updateTemplate(id, body); }
  @Delete('templates/:id') removeTemplate(@Param('id') id: string) { return this.email.removeTemplate(id); }
  @Get() list(@Query() query: any) { return this.email.list(query); }
  @Post('send') send(@CurrentUser() user: AuthUser, @Body() body: any) { return this.email.send(user, body); }
  @Post('sync') sync(@CurrentUser() user: AuthUser) { return this.email.syncInbound(user); }
}

@Module({ controllers: [EmailController], providers: [EmailService] })
export class EmailModule {}
