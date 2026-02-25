/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, APP_GUARD } from '@nestjs/common';
import request from 'supertest';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import cookieParser from 'cookie-parser';
import { cleanDatabase } from './helpers/db.helper';
import { registerUser, TEST_USER } from './helpers/auth.helper';
import { isHttpOnly } from './helpers/cookie.helper';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(ThrottlerModule)
      .useModule(ThrottlerModule.forRoot([{ ttl: 1000, limit: 1000 }]))
      .overrideProvider(APP_GUARD)
      .useClass(ThrottlerGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  describe('/auth/register (POST)', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.user).toBeDefined();
          expect(res.body.user.email).toBe('test@example.com');
          expect(res.body.user.username).toBe('testuser');
          expect(res.body.token).toBeUndefined();
          expect(res.body.user.password).toBeUndefined();
          expect(res.headers['set-cookie']).toBeDefined();
          const cookies: string[] = Array.isArray(res.headers['set-cookie'])
            ? res.headers['set-cookie']
            : [res.headers['set-cookie']];
          expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
        });
    });

    it('should return 409 if email already exists', async () => {
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
      });

      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          username: 'anotheruser',
          password: 'password123',
        })
        .expect(409);
    });

    it('should return 409 if username already exists', async () => {
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
      });

      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'another@example.com',
          username: 'testuser',
          password: 'password123',
        })
        .expect(409);
    });

    it('should return 400 if validation fails', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          username: 'ab',
          password: 'short',
        })
        .expect(400);
    });

    it('should set both access_token and refresh_token cookies on register', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(TEST_USER)
        .expect(201);

      const cookies: string[] = Array.isArray(res.headers['set-cookie'])
        ? res.headers['set-cookie']
        : [res.headers['set-cookie']];
      expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
    });

    it('should set HttpOnly flag on both cookies', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(TEST_USER)
        .expect(201);

      const setCookie = res.headers['set-cookie'] as string[] | string;
      expect(isHttpOnly(setCookie, 'access_token')).toBe(true);
      expect(isHttpOnly(setCookie, 'refresh_token')).toBe(true);
    });
  });

  describe('/auth/login (POST)', () => {
    beforeEach(async () => {
      await request(app.getHttpServer()).post('/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
      });
    });

    it('should login with email', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          emailOrUsername: 'test@example.com',
          password: 'password123',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.user).toBeDefined();
          expect(res.body.token).toBeUndefined();
          expect(res.headers['set-cookie']).toBeDefined();
          const cookies: string[] = Array.isArray(res.headers['set-cookie'])
            ? res.headers['set-cookie']
            : [res.headers['set-cookie']];
          expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
        });
    });

    it('should login with username', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          emailOrUsername: 'testuser',
          password: 'password123',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.user).toBeDefined();
          expect(res.body.token).toBeUndefined();
          expect(res.headers['set-cookie']).toBeDefined();
          const cookies: string[] = Array.isArray(res.headers['set-cookie'])
            ? res.headers['set-cookie']
            : [res.headers['set-cookie']];
          expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
        });
    });

    it('should return 401 if password is wrong', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          emailOrUsername: 'testuser',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('should return 401 if user does not exist', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          emailOrUsername: 'nonexistent',
          password: 'password123',
        })
        .expect(401);
    });

    it('should set both access_token and refresh_token cookies on login', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ emailOrUsername: TEST_USER.email, password: TEST_USER.password })
        .expect(201);

      const cookies: string[] = Array.isArray(res.headers['set-cookie'])
        ? res.headers['set-cookie']
        : [res.headers['set-cookie']];
      expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
    });

    it('should set HttpOnly flag on both cookies on login', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ emailOrUsername: TEST_USER.email, password: TEST_USER.password })
        .expect(201);

      const setCookie = res.headers['set-cookie'] as string[] | string;
      expect(isHttpOnly(setCookie, 'access_token')).toBe(true);
      expect(isHttpOnly(setCookie, 'refresh_token')).toBe(true);
    });
  });

  describe('/auth/me (GET)', () => {
    let cookieValue: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123',
        });

      const setCookieHeader = response.headers['set-cookie'] as
        | string[]
        | string;
      const cookieArray = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader];
      const accessTokenCookie =
        cookieArray.find((c) => c.startsWith('access_token=')) ?? '';
      cookieValue = accessTokenCookie.split(';')[0]; // "access_token=<jwt>"
    });

    it('should return current user with valid cookie', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookieValue)
        .expect(200)
        .expect((res) => {
          expect(res.body.email).toBe('test@example.com');
          expect(res.body.username).toBe('testuser');
          expect(res.body.password).toBeUndefined();
        });
    });

    it('should return 401 without token', () => {
      return request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('should return 401 with invalid token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('/auth/logout (POST)', () => {
    let cookieValue: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          username: 'testuser',
          password: 'password123',
        });

      const setCookieHeader = response.headers['set-cookie'] as
        | string[]
        | string;
      const cookieArray = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader];
      const accessTokenCookie =
        cookieArray.find((c) => c.startsWith('access_token=')) ?? '';
      cookieValue = accessTokenCookie.split(';')[0];
    });

    it('should logout and clear cookie', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookieValue)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Logged out successfully');
          const cookies: string[] = Array.isArray(res.headers['set-cookie'])
            ? res.headers['set-cookie']
            : [res.headers['set-cookie'] ?? ''];
          const clearedCookie = cookies.find((c) =>
            c.startsWith('access_token='),
          );
          expect(clearedCookie).toBeDefined();
          expect(clearedCookie).toMatch(/access_token=;/);
        });
    });

    it('should reject access_token on a protected route after logout (JTI denylist)', async () => {
      const { accessTokenCookie, allCookies } = await registerUser(
        app,
        TEST_USER,
      );

      // Verify token works before logout
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', accessTokenCookie)
        .expect(200);

      // Logout
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', allCookies)
        .expect(200);

      // Old access token should now be rejected
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', accessTokenCookie)
        .expect(401);
    });

    it('should return success even when called without any cookies', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .expect((r) => {
          expect([200, 201]).toContain(r.status);
        });

      expect(res.body.message).toBe('Logged out successfully');
    });
  });

  describe('/auth/refresh (POST)', () => {
    it('should return 401 if refresh_token cookie is missing', async () => {
      await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });

    it('should return 401 if refresh_token is malformed (no dot separator)', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=invalidtoken')
        .expect(401);
    });

    it('should return 401 if refresh_token does not match any stored token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=user-id.fakehash')
        .expect(401);
    });

    it('should refresh tokens and rotate — old refresh token rejected afterward', async () => {
      const { refreshTokenCookie } = await registerUser(app, TEST_USER);

      // First refresh — should succeed
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });

      // Second refresh with old token — should be rejected (token rotation)
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(401);
    });

    it('should issue new access_token and refresh_token cookies on successful refresh', async () => {
      const { refreshTokenCookie } = await registerUser(app, TEST_USER);

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect((r) => {
          expect([200, 201]).toContain(r.status);
        });

      const setCookie = res.headers['set-cookie'] as string[] | string;
      const cookieArray = Array.isArray(setCookie) ? setCookie : [setCookie];
      expect(cookieArray.some((c) => c.startsWith('access_token='))).toBe(true);
      expect(cookieArray.some((c) => c.startsWith('refresh_token='))).toBe(true);
      expect(isHttpOnly(setCookie, 'access_token')).toBe(true);
      expect(isHttpOnly(setCookie, 'refresh_token')).toBe(true);
    });
  });

  describe('/auth/verify-email (POST)', () => {
    it('should return 400 for an invalid/nonexistent token', async () => {
      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token: 'nonexistent-token-abc123' })
        .expect(400);
    });

    it('should return 400 for an empty token', async () => {
      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token: '' })
        .expect(400);
    });

    it('should verify email successfully with a valid token', async () => {
      await registerUser(app, TEST_USER);

      const userRecord = await prisma.user.findUnique({
        where: { email: TEST_USER.email },
      });
      const token = userRecord!.emailVerificationToken;

      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token })
        .expect(200);

      // Verify via /auth/me — need fresh login since verify-email doesn't return cookies
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          emailOrUsername: TEST_USER.email,
          password: TEST_USER.password,
        });
      const setCookieHeader = loginRes.headers['set-cookie'] as
        | string
        | string[];
      const cookieArray = Array.isArray(setCookieHeader)
        ? setCookieHeader
        : [setCookieHeader];
      const loginAccessCookie = cookieArray
        .find((c) => c.startsWith('access_token='))!
        .split(';')[0];

      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', loginAccessCookie)
        .expect(200);

      expect(meRes.body.isEmailVerified).toBe(true);
    });
  });

  describe('/auth/resend-verification (POST)', () => {
    it('should always return 200 even if email does not exist (enumeration protection)', async () => {
      await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .send({ email: 'nobody@example.com' })
        .expect(200);
    });

    it('should always return 200 even if user is already verified (enumeration protection)', async () => {
      await registerUser(app, TEST_USER);

      // Verify the user first
      const userRecord = await prisma.user.findUnique({
        where: { email: TEST_USER.email },
      });
      const token = userRecord!.emailVerificationToken;
      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token });

      // Resend should still return 200
      await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .send({ email: TEST_USER.email })
        .expect(200);
    });
  });

  describe('/auth/forgot-password (POST)', () => {
    it('should always return 200 even if email does not exist (enumeration protection)', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'nobody@example.com' })
        .expect(200);
    });
  });

  describe('/auth/reset-password (POST)', () => {
    it('should return 400 for an invalid/nonexistent token', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'bad-token', password: 'NewPassword1!' })
        .expect(400);
    });

    it('should reset password and allow login with new password', async () => {
      await registerUser(app, TEST_USER);

      // Trigger forgot-password to generate a reset token
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: TEST_USER.email });

      const userRecord = await prisma.user.findUnique({
        where: { email: TEST_USER.email },
      });
      const resetToken = userRecord!.passwordResetToken!;

      // Reset the password
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: resetToken, password: 'NewPassword1!' })
        .expect(200);

      // Login with new password should succeed
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ emailOrUsername: TEST_USER.email, password: 'NewPassword1!' })
        .expect(201);
    });

    it('should reject old password after reset', async () => {
      await registerUser(app, TEST_USER);

      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: TEST_USER.email });

      const userRecord = await prisma.user.findUnique({
        where: { email: TEST_USER.email },
      });
      const resetToken = userRecord!.passwordResetToken!;

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: resetToken, password: 'NewPassword1!' })
        .expect(200);

      // Login with OLD password should fail
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ emailOrUsername: TEST_USER.email, password: TEST_USER.password })
        .expect(401);
    });
  });
});
