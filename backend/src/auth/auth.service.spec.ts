import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('returns a token and strips the password hash on login', async () => {
    const password = await bcrypt.hash('salesfroge', 4);
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'avery@salesfroge.local',
          password,
          firstName: 'Avery',
          lastName: 'Chen',
          isActive: true,
          isAdmin: true,
          roleId: null,
          googleCalendarTokens: { access_token: 'hidden' },
          outlookCalendarTokens: null,
        }),
      },
    };
    const jwt: any = { sign: jest.fn().mockReturnValue('signed-token') };
    const result = await new AuthService(prisma, jwt).login('Avery@salesfroge.local', 'salesfroge');
    expect(result.token).toBe('signed-token');
    expect(result.user).not.toHaveProperty('password');
    expect(result.user).not.toHaveProperty('googleCalendarTokens');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'avery@salesfroge.local' } });
  });

  it('rejects a wrong password', async () => {
    const password = await bcrypt.hash('salesfroge', 4);
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', password, isActive: true }) },
    };
    await expect(new AuthService(prisma, { sign: jest.fn() } as any).login('a@b.co', 'nope')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
