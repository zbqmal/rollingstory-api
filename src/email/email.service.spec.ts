import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

// Mock the Resend SDK
const mockEmailsSend = jest.fn();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockEmailsSend,
    },
  })),
}));

describe('EmailService', () => {
  let service: EmailService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        RESEND_API_KEY: 're_test_key',
        EMAIL_FROM: 'noreply@example.com',
        FRONTEND_URL: 'http://localhost:3000',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendVerificationEmail', () => {
    it('should send a verification email with a link containing the token', async () => {
      mockEmailsSend.mockResolvedValue({
        data: { id: 'email-id' },
        error: null,
      });

      await service.sendVerificationEmail('user@example.com', 'abc123token');

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@example.com',
          to: 'user@example.com',
          subject: 'Verify your email address',
          html: expect.stringContaining(
            'http://localhost:3000/verify-email?token=abc123token',
          ),
        }),
      );
    });

    it('should log an error if send fails but not throw', async () => {
      mockEmailsSend.mockResolvedValue({
        data: null,
        error: { message: 'Send failed' },
      });

      await expect(
        service.sendVerificationEmail('user@example.com', 'token'),
      ).resolves.not.toThrow();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send a password reset email with a link containing the token', async () => {
      mockEmailsSend.mockResolvedValue({
        data: { id: 'email-id' },
        error: null,
      });

      await service.sendPasswordResetEmail('user@example.com', 'resettoken');

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@example.com',
          to: 'user@example.com',
          subject: 'Reset your password',
          html: expect.stringContaining(
            'http://localhost:3000/reset-password?token=resettoken',
          ),
        }),
      );
    });

    it('should log an error if send fails but not throw', async () => {
      mockEmailsSend.mockResolvedValue({
        data: null,
        error: { message: 'Send failed' },
      });

      await expect(
        service.sendPasswordResetEmail('user@example.com', 'token'),
      ).resolves.not.toThrow();
    });
  });
});
