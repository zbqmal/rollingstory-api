import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private createTransporter() {
    // Required env vars:
    //   EMAIL_FROM  — sender address (e.g. noreply@rollingstory.app)
    //   SMTP_HOST   — SMTP host
    //   SMTP_PORT   — SMTP port (default 587)
    //   SMTP_USER   — SMTP username
    //   SMTP_PASS   — SMTP password
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    if (!process.env.SMTP_HOST) {
      this.logger.warn(
        'SMTP_HOST is not set — skipping verification email send.',
      );
      return;
    }

    // FRONTEND_URL — the frontend base URL (e.g. https://rollingstory-web-dev.vercel.app)
    const link = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    await this.createTransporter().sendMail({
      from: process.env.EMAIL_FROM ?? 'noreply@rollingstory.app',
      to,
      subject: 'Verify your RollingStory email',
      html: `
        <p>Welcome to RollingStory!</p>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${link}">${link}</a></p>
        <p>This link expires in 24 hours.</p>
      `,
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    if (!process.env.SMTP_HOST) {
      this.logger.warn(
        'SMTP_HOST is not set — skipping password reset email send.',
      );
      return;
    }

    // FRONTEND_URL — the frontend base URL (e.g. https://rollingstory-web-dev.vercel.app)
    const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await this.createTransporter().sendMail({
      from: process.env.EMAIL_FROM ?? 'noreply@rollingstory.app',
      to,
      subject: 'Reset your RollingStory password',
      html: `
        <p>You requested a password reset for your RollingStory account.</p>
        <p>Click the link below to set a new password:</p>
        <p><a href="${link}">${link}</a></p>
        <p>This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>
      `,
    });
  }
}
