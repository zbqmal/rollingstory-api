import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

type ResendSendPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
};

type ResendSendResult = {
  data: { id: string } | null;
  error: { message: string } | null;
};

// Mock the Resend SDK
const mockEmailsSend = jest.fn<
  Promise<ResendSendResult>,
  [ResendSendPayload]
>();
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockEmailsSend,
    },
  })),
}));

describe('EmailService', () => {
  let service: EmailService;

  const createService = async (
    overrides?: Record<string, string | undefined>,
  ) => {
    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          RESEND_API_KEY: 're_test_key',
          EMAIL_FROM: 'noreply@example.com',
          FRONTEND_URL: 'http://localhost:3000',
          NODE_ENV: 'development',
        };
        if (overrides && Object.prototype.hasOwnProperty.call(overrides, key)) {
          return overrides[key];
        }
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    return module.get<EmailService>(EmailService);
  };

  beforeEach(async () => {
    service = await createService();
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

      const [payload] = mockEmailsSend.mock.calls[0] ?? [];
      const typedPayload = payload as {
        from?: string;
        to?: string;
        subject?: string;
        html?: string;
      };

      expect(typedPayload).toEqual(
        expect.objectContaining({
          from: 'noreply@example.com',
          to: 'user@example.com',
          subject: 'Verify your email address',
        }),
      );
      expect(typedPayload.html).toContain(
        'http://localhost:3000/verify-email?token=abc123token',
      );
    });

    it('should fall back to the default sender when EMAIL_FROM is missing', async () => {
      service = await createService({ EMAIL_FROM: undefined });
      mockEmailsSend.mockResolvedValue({
        data: { id: 'email-id' },
        error: null,
      });

      await service.sendVerificationEmail('user@example.com', 'abc123token');

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'onboarding@resend.dev',
        }),
      );
    });

    it('should skip sending verification emails in test env', async () => {
      service = await createService({ NODE_ENV: 'test' });

      await service.sendVerificationEmail('user@example.com', 'abc123token');

      expect(mockEmailsSend).not.toHaveBeenCalled();
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

      const [payload] = mockEmailsSend.mock.calls[0] ?? [];
      const typedPayload = payload as {
        from?: string;
        to?: string;
        subject?: string;
        html?: string;
      };

      expect(typedPayload).toEqual(
        expect.objectContaining({
          from: 'noreply@example.com',
          to: 'user@example.com',
          subject: 'Reset your password',
        }),
      );
      expect(typedPayload.html).toContain(
        'http://localhost:3000/reset-password?token=resettoken',
      );
    });

    it('should skip sending password reset emails in test env', async () => {
      service = await createService({ NODE_ENV: 'test' });

      await service.sendPasswordResetEmail('user@example.com', 'resettoken');

      expect(mockEmailsSend).not.toHaveBeenCalled();
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
