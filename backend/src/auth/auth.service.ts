import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const AVATAR_COLORS = ['#1b5f8c', '#0b827c', '#9050e9', '#b60554', '#ba0517', '#e07c00', '#0176d3'];

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  private sign(userId: string): string {
    return this.jwt.sign({ sub: userId });
  }

  private publicUser(user: any) {
    const { password, googleCalendarTokens, outlookCalendarTokens, ...rest } = user;
    return rest;
  }

  async register(input: { email: string; password: string; firstName: string; lastName: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) throw new ConflictException('A user with this email already exists');

    const hash = await bcrypt.hash(input.password, 10);
    const count = await this.prisma.user.count();
    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        password: hash,
        firstName: input.firstName,
        lastName: input.lastName,
        isAdmin: count === 0, // first user becomes admin
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      },
    });
    return { token: this.sign(user.id), user: this.publicUser(user) };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.password) throw new UnauthorizedException('Invalid email or password');
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid email or password');
    if (!user.isActive) throw new UnauthorizedException('This account is deactivated');
    return { token: this.sign(user.id), user: this.publicUser(user) };
  }

  async validateGoogleUser(profile: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
  }) {
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ googleId: profile.googleId }, { email: profile.email.toLowerCase() }] },
    });
    if (!user) {
      const count = await this.prisma.user.count();
      user = await this.prisma.user.create({
        data: {
          email: profile.email.toLowerCase(),
          googleId: profile.googleId,
          firstName: profile.firstName,
          lastName: profile.lastName,
          isAdmin: count === 0,
          avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        },
      });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { googleId: profile.googleId } });
    }
    return { token: this.sign(user.id), user: this.publicUser(user) };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user) throw new UnauthorizedException();
    return this.publicUser(user);
  }
}
