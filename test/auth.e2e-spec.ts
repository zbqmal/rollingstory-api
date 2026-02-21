/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import cookieParser from 'cookie-parser';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(ThrottlerModule)
      .useModule(ThrottlerModule.forRoot([{ ttl: 1000, limit: 1000 }]))
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
    // Clean up database before each test
    await prisma.workCollaborator.deleteMany();
    await prisma.page.deleteMany();
    await prisma.work.deleteMany();
    await prisma.user.deleteMany();
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
        .expect(201)
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
  });
});

describe('Auth rate limiting (e2e)', () => {
  let rateLimitApp: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    rateLimitApp = moduleFixture.createNestApplication();
    rateLimitApp.use(cookieParser());
    rateLimitApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await rateLimitApp.init();

    prisma = rateLimitApp.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await rateLimitApp.close();
  });

  beforeEach(async () => {
    await prisma.workCollaborator.deleteMany();
    await prisma.page.deleteMany();
    await prisma.work.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('/auth/login rate limiting', () => {
    it('should return 429 after exceeding rate limit', async () => {
      for (let i = 0; i < 5; i++) {
        await request(rateLimitApp.getHttpServer())
          .post('/auth/login')
          .send({ emailOrUsername: 'nonexistent', password: 'password123' });
      }
      return request(rateLimitApp.getHttpServer())
        .post('/auth/login')
        .send({ emailOrUsername: 'nonexistent', password: 'password123' })
        .expect(429);
    });
  });
});
