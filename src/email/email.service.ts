import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly frontendUrl: string;
  private readonly emailDisabled: boolean;
  private readonly logger = new Logger(EmailService.name);

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY') ?? '';
    this.from =
      this.config.get<string>('EMAIL_FROM') ?? 'onboarding@resend.dev';
    this.frontendUrl = this.config.get<string>('FRONTEND_URL') ?? '';
    this.emailDisabled = this.config.get<string>('NODE_ENV') === 'test';
    this.resend = new Resend(apiKey);
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    if (this.emailDisabled) {
      return;
    }

    const link = `${this.frontendUrl}/verify-email?token=${token}`;
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Verify your email address',
      html: `<p>Thank you for registering! Please verify your email address by clicking the link below:</p>
<p><a href="${link}">Verify Email</a></p>
<p>This link will expire in 24 hours.</p>
<p>If you did not create an account, you can safely ignore this email.</p>`,
    });

    if (error) {
      this.logger.error(`Failed to send verification email to ${to}`, error);
    }
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    if (this.emailDisabled) {
      return;
    }

    const link = `${this.frontendUrl}/reset-password?token=${token}`;
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Reset your password',
      html: `<p>We received a request to reset your password. Click the link below to choose a new password:</p>
<p><a href="${link}">Reset Password</a></p>
<p>This link will expire in 1 hour.</p>
<p>If you did not request a password reset, you can safely ignore this email.</p>`,
    });

    if (error) {
      this.logger.error(`Failed to send password reset email to ${to}`, error);
    }
  }
}
