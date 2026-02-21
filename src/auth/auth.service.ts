import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { Response } from 'express';

// Password must have uppercase, lowercase, number, and special character
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$/;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  private async issueTokens(
    userId: string,
    email: string,
    res: Response,
  ): Promise<void> {
    const accessToken = this.jwtService.sign(
      { sub: userId, email },
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

    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    res.cookie('refresh_token', rawRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  async register(dto: RegisterDto, res: Response) {
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

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        password: hashedPassword,
      },
    });

    // Generate email verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: verifyToken,
        emailVerifyExpiry: verifyExpiry,
      },
    });

    await this.emailService.sendVerificationEmail(user.email, verifyToken);

    await this.issueTokens(user.id, user.email, res);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
    };
  }

  async login(dto: LoginDto, res: Response) {
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

    await this.issueTokens(user.id, user.email, res);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
    };
  }

  async refreshTokens(refreshToken: string, res: Response) {
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

    await this.issueTokens(user.id, user.email, res);

    return { message: 'Tokens refreshed' };
  }

  async logout(userId: string, res: Response) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });

    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });

    return { message: 'Logged out' };
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
      createdAt: user.createdAt,
    };
  }

  async verifyEmail(token: string) {
    const now = new Date();
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
        emailVerifyExpiry: { gt: now },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpiry: null,
      },
    });

    return { message: 'Email verified successfully' };
  }

  async forgotPassword(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    const genericResponse = {
      message: 'If that email exists, a reset link has been sent',
    };

    if (!user) {
      return genericResponse;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpiry: resetExpiry,
      },
    });

    await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return genericResponse;
  }

  async resetPassword(token: string, newPassword: string) {
    const now = new Date();
    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpiry: { gt: now },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Validate password policy (same as registration)
    if (!PASSWORD_POLICY.test(newPassword)) {
      throw new BadRequestException(
        'Password must be at least 8 characters and include uppercase, lowercase, number, and special character',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpiry: null,
      },
    });

    // Invalidate all refresh tokens to force re-login
    await this.prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    return { message: 'Password reset successfully' };
  }
}
