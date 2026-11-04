import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SharingService } from '../common/sharing.service';
import { AuthUser, CurrentUser, Public } from '../common/decorators';
import { andWhere } from '../common/data';

function secret() {
  return process.env.JWT_SECRET || 'change-me-in-production';
}

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService, private sharing: SharingService, private jwt: JwtService) {}

  async events(user: AuthUser, from?: string, to?: string) {
    const start = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = to ? new Date(to) : new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const scope = await this.sharing.readScope(user, 'Activity');
    const [meetings, tasks] = await Promise.all([
      this.prisma.activity.findMany({
        where: andWhere(scope, { type: 'Meeting', startTime: { gte: start, lte: end } }),
        include: { owner: { select: { firstName: true, lastName: true, avatarColor: true } } },
      }),
      this.prisma.activity.findMany({
        where: andWhere(scope, { type: 'Task', dueDate: { gte: start, lte: end } }),
        include: { owner: { select: { firstName: true, lastName: true, avatarColor: true } } },
      }),
    ]);
    return [...meetings, ...tasks];
  }

  async status(user: AuthUser) {
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    return {
      googleConfigured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      outlookConfigured: !!(process.env.OUTLOOK_CLIENT_ID && process.env.OUTLOOK_CLIENT_SECRET),
      googleConnected: !!dbUser?.googleCalendarTokens,
      outlookConnected: !!dbUser?.outlookCalendarTokens,
    };
  }

  connectUrl(user: AuthUser, provider: 'google' | 'outlook') {
    const state = this.jwt.sign({ sub: user.id, provider }, { expiresIn: '20m', secret: secret() });
    if (provider === 'google') {
      if (!process.env.GOOGLE_CLIENT_ID) throw new BadRequestException('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to connect Google Calendar.');
      const redirect = process.env.GOOGLE_CALENDAR_CALLBACK_URL || 'http://localhost:4000/api/calendar/google/callback';
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: redirect,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar.events',
        access_type: 'offline',
        prompt: 'consent',
        state,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }
    if (!process.env.OUTLOOK_CLIENT_ID) throw new BadRequestException('Set OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET to connect Outlook.');
    const redirect = process.env.OUTLOOK_CALLBACK_URL || 'http://localhost:4000/api/calendar/outlook/callback';
    const params = new URLSearchParams({
      client_id: process.env.OUTLOOK_CLIENT_ID,
      redirect_uri: redirect,
      response_type: 'code',
      response_mode: 'query',
      scope: 'offline_access Calendars.ReadWrite User.Read',
      state,
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
  }

  async handleCallback(provider: 'google' | 'outlook', code: string, state: string) {
    const payload = this.jwt.verify(state, { secret: secret() }) as { sub: string; provider: string };
    if (payload.provider !== provider) throw new BadRequestException('OAuth state mismatch');
    const tokens = provider === 'google' ? await this.exchangeGoogle(code) : await this.exchangeOutlook(code);
    const data = provider === 'google' ? { googleCalendarTokens: { ...tokens, obtained_at: Date.now() } } : { outlookCalendarTokens: { ...tokens, obtained_at: Date.now() } };
    await this.prisma.user.update({ where: { id: payload.sub }, data });
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${frontend}/calendar?connected=${provider}`;
  }

  private async exchangeGoogle(code: string) {
    const body = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: process.env.GOOGLE_CALENDAR_CALLBACK_URL || 'http://localhost:4000/api/calendar/google/callback',
      grant_type: 'authorization_code',
    });
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = await response.json();
    if (!json.access_token) throw new BadRequestException(json.error_description || 'Google token exchange failed');
    return json;
  }

  private async exchangeOutlook(code: string) {
    const body = new URLSearchParams({
      code,
      client_id: process.env.OUTLOOK_CLIENT_ID || '',
      client_secret: process.env.OUTLOOK_CLIENT_SECRET || '',
      redirect_uri: process.env.OUTLOOK_CALLBACK_URL || 'http://localhost:4000/api/calendar/outlook/callback',
      grant_type: 'authorization_code',
    });
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = await response.json();
    if (!json.access_token) throw new BadRequestException(json.error_description || 'Outlook token exchange failed');
    return json;
  }

  async disconnect(user: AuthUser, provider: 'google' | 'outlook') {
    const data = provider === 'google' ? { googleCalendarTokens: Prisma.DbNull } : { outlookCalendarTokens: Prisma.DbNull };
    await this.prisma.user.update({ where: { id: user.id }, data });
    return { success: true };
  }

  async sync(user: AuthUser, provider: 'google' | 'outlook') {
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) throw new BadRequestException('User not found');
    const accessToken = provider === 'google' ? await this.googleToken(dbUser) : await this.outlookToken(dbUser);
    const meetings = await this.prisma.activity.findMany({
      where: { ownerId: user.id, type: 'Meeting', startTime: { not: null } },
    });
    const idKey = provider === 'google' ? 'googleEventId' : 'outlookEventId';
    let synced = 0;
    for (const meeting of meetings) {
      const custom = (meeting.customFields as any) || {};
      if (custom[idKey]) continue;
      const eventId = provider === 'google' ? await this.pushGoogle(accessToken, meeting) : await this.pushOutlook(accessToken, meeting);
      await this.prisma.activity.update({
        where: { id: meeting.id },
        data: { customFields: { ...custom, [idKey]: eventId } },
      });
      synced += 1;
    }
    return { provider, synced };
  }

  private async googleToken(user: any) {
    const tokens = user.googleCalendarTokens as any;
    if (!tokens?.access_token) throw new BadRequestException('Google Calendar is not connected');
    const fresh = tokens.obtained_at && tokens.expires_in && tokens.obtained_at + tokens.expires_in * 1000 - 30000 > Date.now();
    if (fresh || !tokens.refresh_token) return tokens.access_token;
    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    });
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = await response.json();
    if (!json.access_token) throw new BadRequestException('Google token refresh failed');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { googleCalendarTokens: { ...tokens, ...json, obtained_at: Date.now() } },
    });
    return json.access_token as string;
  }

  private async outlookToken(user: any) {
    const tokens = user.outlookCalendarTokens as any;
    if (!tokens?.access_token) throw new BadRequestException('Outlook is not connected');
    const fresh = tokens.obtained_at && tokens.expires_in && tokens.obtained_at + tokens.expires_in * 1000 - 30000 > Date.now();
    if (fresh || !tokens.refresh_token) return tokens.access_token;
    const body = new URLSearchParams({
      client_id: process.env.OUTLOOK_CLIENT_ID || '',
      client_secret: process.env.OUTLOOK_CLIENT_SECRET || '',
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    });
    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = await response.json();
    if (!json.access_token) throw new BadRequestException('Outlook token refresh failed');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { outlookCalendarTokens: { ...tokens, ...json, obtained_at: Date.now() } },
    });
    return json.access_token as string;
  }

  private async pushGoogle(token: string, meeting: any) {
    const start = new Date(meeting.startTime);
    const end = meeting.endTime ? new Date(meeting.endTime) : new Date(start.getTime() + 60 * 60 * 1000);
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: meeting.subject,
        description: meeting.description || '',
        location: meeting.location || undefined,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      }),
    });
    const json = await response.json();
    if (!json.id) throw new BadRequestException(json.error?.message || 'Google event creation failed');
    return json.id as string;
  }

  private async pushOutlook(token: string, meeting: any) {
    const start = new Date(meeting.startTime);
    const end = meeting.endTime ? new Date(meeting.endTime) : new Date(start.getTime() + 60 * 60 * 1000);
    const stamp = (date: Date) => date.toISOString().replace('Z', '');
    const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: meeting.subject,
        body: { contentType: 'Text', content: meeting.description || '' },
        location: meeting.location ? { displayName: meeting.location } : undefined,
        start: { dateTime: stamp(start), timeZone: 'UTC' },
        end: { dateTime: stamp(end), timeZone: 'UTC' },
      }),
    });
    const json = await response.json();
    if (!json.id) throw new BadRequestException(json.error?.message || 'Outlook event creation failed');
    return json.id as string;
  }
}

@Controller('calendar')
export class CalendarController {
  constructor(private calendar: CalendarService) {}

  @Get('events')
  events(@CurrentUser() user: AuthUser, @Query('from') from?: string, @Query('to') to?: string) {
    return this.calendar.events(user, from, to);
  }

  @Get('status')
  status(@CurrentUser() user: AuthUser) {
    return this.calendar.status(user);
  }

  @Get('google/connect')
  googleConnect(@CurrentUser() user: AuthUser, @Res() res: Response) {
    res.redirect(this.calendar.connectUrl(user, 'google'));
  }

  @Public()
  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const url = await this.calendar.handleCallback('google', code, state);
    res.redirect(url);
  }

  @Delete('google')
  googleDisconnect(@CurrentUser() user: AuthUser) {
    return this.calendar.disconnect(user, 'google');
  }

  @Get('outlook/connect')
  outlookConnect(@CurrentUser() user: AuthUser, @Res() res: Response) {
    res.redirect(this.calendar.connectUrl(user, 'outlook'));
  }

  @Public()
  @Get('outlook/callback')
  async outlookCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const url = await this.calendar.handleCallback('outlook', code, state);
    res.redirect(url);
  }

  @Delete('outlook')
  outlookDisconnect(@CurrentUser() user: AuthUser) {
    return this.calendar.disconnect(user, 'outlook');
  }

  @Post('sync')
  async sync(@CurrentUser() user: AuthUser, @Body() body: any) {
    const provider = body?.provider || 'google';
    if (provider === 'all') {
      const status = await this.calendar.status(user);
      const results: { provider: string; synced: number }[] = [];
      if (status.googleConnected) results.push(await this.calendar.sync(user, 'google'));
      if (status.outlookConnected) results.push(await this.calendar.sync(user, 'outlook'));
      if (!results.length) throw new BadRequestException('Connect Google Calendar or Outlook before syncing.');
      return { results };
    }
    return this.calendar.sync(user, provider);
  }
}

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET || 'change-me-in-production' })],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
