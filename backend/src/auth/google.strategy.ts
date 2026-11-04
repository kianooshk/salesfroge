import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

/**
 * Google OAuth is optional. When GOOGLE_CLIENT_ID is not set the strategy is
 * still registered (with placeholder values) but the controller guards against
 * use; the register call simply won't be reached without credentials.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || 'not-configured',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'not-configured',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
    const { id, name, emails } = profile;
    const user = {
      googleId: id,
      email: emails?.[0]?.value,
      firstName: name?.givenName || 'Google',
      lastName: name?.familyName || 'User',
    };
    done(null, user);
  }
}
