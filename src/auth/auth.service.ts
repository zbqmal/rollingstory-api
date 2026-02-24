import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { Redis } from 'ioredis';
import type { Request, Response } from 'express';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  private getCookieOptions(req: Request): {
    sameSite: 'none' | 'strict' | 'lax';
    secure: boolean;
  } {
    return { sameSite: 'lax', secure: true };
    // const origin = req.headers['origin'] as string | undefined;

    // 1. Local Development
    // Localhost is considered "same-site", so we use Lax and don't need Secure=true
    // if (origin && origin.startsWith('http://localhost')) {
    //   return { sameSite: 'lax', secure: false };
    // }

    // // 2. Deployed Environments (Dev & Prod)
    // const allowedOrigins = new Set([
    //   'https://rollingstory-web-prod.vercel.app',
    //   'https://rollingstory-web-dev.vercel.app',
    // ]);

    // // Cross-site requests require SameSite=None and Secure=true
    // if (origin && allowedOrigins.has(origin)) {
    //   return { sameSite: 'none', secure: true };
    // }

    // // 3. Fallback for unrecognized origins
    // return { sameSite: 'strict', secure: true };
  }

  private async issueTokens(
    userId: string,
    email: string,
    res: Response,
    req: Request,
  ): Promise<void> {
    const jti = crypto.randomUUID();
    const accessToken = this.jwtService.sign(
      { sub: userId, email, jti },
      { expiresIn: '15m' },
    );

    // Prefix the raw token with userId so refreshTokens can scope the DB lookup
    const rawRefreshToken = `${userId}.${crypto.randomBytes(64).toString('hex')}`;
    const hashedRefreshToken = await bcrypt.hash(rawRefreshToken, 12);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        token: hashedRefreshToken,
        userId,
        expiresAt,
      },
    });

    const { sameSite, secure } = this.getCookieOptions(req);

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    res.cookie('refresh_token', rawRefreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  async register(dto: RegisterDto, res: Response, req: Request) {
    // Check if email exists
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    // Check if username exists
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Generate email verification token (32 bytes hex = 64 chars)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiresAt = new Date();
    verificationTokenExpiresAt.setHours(
      verificationTokenExpiresAt.getHours() + 24,
    );

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        password: hashedPassword,
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpiresAt: verificationTokenExpiresAt,
      },
    });

    // Send verification email (fire-and-forget: registration succeeds even if
    // email delivery fails; errors are logged inside EmailService)
    void this.emailService.sendVerificationEmail(user.email, verificationToken);

    await this.issueTokens(user.id, user.email, res, req);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
    };
  }

  async login(dto: LoginDto, res: Response, req: Request) {
    // Find user by email or username
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.emailOrUsername }, { username: dto.emailOrUsername }],
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.issueTokens(user.id, user.email, res, req);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
    };
  }

  async refreshTokens(refreshToken: string, res: Response, req: Request) {
    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }

    // Extract userId prefix from the token to scope the DB query
    const dotIndex = refreshToken.indexOf('.');
    if (dotIndex === -1) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const userId = refreshToken.substring(0, dotIndex);

    const now = new Date();
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, expiresAt: { gt: now } },
    });

    let matchedToken: (typeof tokens)[0] | null = null;
    for (const t of tokens) {
      const isMatch = await bcrypt.compare(refreshToken, t.token);
      if (isMatch) {
        matchedToken = t;
        break;
      }
    }

    if (!matchedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.delete({ where: { id: matchedToken.id } });

    const user = await this.prisma.user.findUnique({
      where: { id: matchedToken.userId },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    await this.issueTokens(user.id, user.email, res, req);

    return { message: 'Tokens refreshed' };
  }

  async logout(req: Request, res: Response) {
    const refreshToken = req.cookies?.['refresh_token'] as string | undefined;
    const accessToken = req.cookies?.['access_token'] as string | undefined;

    // Denylist the access token jti in Redis if present
    if (accessToken) {
      try {
        const decoded = this.jwtService.decode(accessToken) as {
          jti?: string;
          exp?: number;
        } | null;
        if (decoded?.jti && decoded?.exp) {
          const ttl = Math.max(decoded.exp - Math.floor(Date.now() / 1000), 1);
          await this.redis.set(`denylist:${decoded.jti}`, '1', 'EX', ttl);
        }
      } catch (err) {
        this.logger.warn(
          `Failed to denylist access token jti: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (!refreshToken) {
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/' });
      return { message: 'Logged out successfully' };
    }

    const dotIndex = refreshToken.indexOf('.');
    if (dotIndex !== -1) {
      const userId = refreshToken.substring(0, dotIndex);
      const tokens = await this.prisma.refreshToken.findMany({
        where: { userId },
      });

      for (const t of tokens) {
        const isMatch = await bcrypt.compare(refreshToken, t.token);
        if (isMatch) {
          await this.prisma.refreshToken.delete({ where: { id: t.id } });
          break;
        }
      }
    }

    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });

    return { message: 'Logged out successfully' };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findUnique({
      where: { emailVerificationToken: token },
    });

    if (
      !user ||
      !user.emailVerificationTokenExpiresAt ||
      user.emailVerificationTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
      },
    });

    return { message: 'Email verified successfully' };
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && !user.isEmailVerified) {
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationTokenExpiresAt = new Date();
      verificationTokenExpiresAt.setHours(
        verificationTokenExpiresAt.getHours() + 24,
      );

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: verificationToken,
          emailVerificationTokenExpiresAt: verificationTokenExpiresAt,
        },
      });

      // Fire-and-forget: always return 200 regardless of email delivery outcome
      // to prevent email enumeration attacks
      void this.emailService.sendVerificationEmail(
        user.email,
        verificationToken,
      );
    }

    // Always return 200 to prevent email enumeration
    return {
      message:
        'If an unverified account with that email exists, a verification email has been sent',
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiresAt = new Date();
      resetTokenExpiresAt.setHours(resetTokenExpiresAt.getHours() + 1);

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetTokenExpiresAt: resetTokenExpiresAt,
        },
      });

      // Fire-and-forget: always return 200 regardless of email delivery outcome
      // to prevent email enumeration attacks
      void this.emailService.sendPasswordResetEmail(user.email, resetToken);
    }

    // Always return 200 to prevent email enumeration
    return {
      message:
        'If an account with that email exists, a password reset email has been sent',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { passwordResetToken: token },
    });

    if (
      !user ||
      !user.passwordResetTokenExpiresAt ||
      user.passwordResetTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
      },
    });

    return { message: 'Password reset successfully' };
  }
}
