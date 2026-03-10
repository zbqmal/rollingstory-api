/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import cookieParser from 'cookie-parser';
import { cleanDatabase } from './helpers/db.helper';
import { registerUser, TEST_USER, TEST_USER_2 } from './helpers/auth.helper';

describe('Works (e2e)', () => {
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
    await cleanDatabase(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  describe('POST /works', () => {
    it('should return 401 if not authenticated', () => {
      return request(app.getHttpServer())
        .post('/works')
        .send({ title: 'Some Work' })
        .expect(401);
    });

    it('should create a new work with all fields', async () => {
      const auth = await registerUser(app, TEST_USER);

      const res = await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({
          title: 'Full Work',
          description: 'A great story',
          type: 'novel',
          pageCharLimit: 3000,
          allowCollaboration: true,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Full Work');
      expect(res.body.author.id).toBe(auth.userId);
      expect(res.body.author.password).toBeUndefined();
    });

    it('should create a work with only required fields (defaults applied)', async () => {
      const auth = await registerUser(app, TEST_USER);

      const res = await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'Min Work' })
        .expect(201);

      expect(res.body.type).toBe('novel');
      expect(res.body.pageCharLimit).toBe(2000);
      expect(res.body.allowCollaboration).toBe(true);
    });

    it('should return 400 if title is missing', async () => {
      const auth = await registerUser(app, TEST_USER);

      return request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({})
        .expect(400);
    });

    it('should return 400 if title is too short (< 3 chars)', async () => {
      const auth = await registerUser(app, TEST_USER);

      return request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'ab' })
        .expect(400);
    });

    it('should return 400 if title is too long (> 200 chars)', async () => {
      const auth = await registerUser(app, TEST_USER);

      return request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'a'.repeat(201) })
        .expect(400);
    });

    it('should create a work with a valid genre', async () => {
      const auth = await registerUser(app, TEST_USER);

      const res = await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'Genre Work', genre: 'fantasy' })
        .expect(201);

      expect(res.body.genre).toBe('fantasy');
    });

    it('should return 400 if genre is invalid', async () => {
      const auth = await registerUser(app, TEST_USER);

      return request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'Bad Genre Work', genre: 'invalid-genre' })
        .expect(400);
    });

    it('should have null genre when not provided', async () => {
      const auth = await registerUser(app, TEST_USER);

      const res = await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'No Genre Work' })
        .expect(201);

      expect(res.body.genre).toBeNull();
    });
  });

  describe('GET /works', () => {
    it('should return empty list when no works exist', () => {
      return request(app.getHttpServer())
        .get('/works')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.data.length).toBe(0);
          expect(res.body.total).toBe(0);
        });
    });

    it('should return list of works with pagination metadata', async () => {
      const auth = await registerUser(app, TEST_USER);

      for (let i = 1; i <= 3; i++) {
        await request(app.getHttpServer())
          .post('/works')
          .set('Cookie', auth.allCookies)
          .send({ title: `Work ${i}` });
      }

      const res = await request(app.getHttpServer()).get('/works').expect(200);

      expect(res.body.data.length).toBe(3);
      expect(res.body.total).toBe(3);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(10);
    });

    it('should paginate correctly with page and limit params', async () => {
      const auth = await registerUser(app, TEST_USER);

      for (let i = 1; i <= 3; i++) {
        await request(app.getHttpServer())
          .post('/works')
          .set('Cookie', auth.allCookies)
          .send({ title: `Work ${i}` });
      }

      const page1 = await request(app.getHttpServer())
        .get('/works?page=1&limit=2')
        .expect(200);
      expect(page1.body.data.length).toBe(2);

      const page2 = await request(app.getHttpServer())
        .get('/works?page=2&limit=2')
        .expect(200);
      expect(page2.body.data.length).toBe(1);
    });

    it('should be accessible without authentication', () => {
      return request(app.getHttpServer()).get('/works').expect(200);
    });
  });

  describe('GET /works/my', () => {
    it('should return 401 if not authenticated', () => {
      return request(app.getHttpServer()).get('/works/my').expect(401);
    });

    it("should return only the authenticated user's works", async () => {
      const user1 = await registerUser(app, TEST_USER);
      const user2 = await registerUser(app, TEST_USER_2);

      await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', user1.allCookies)
        .send({ title: 'User1 Work 1' });

      await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', user1.allCookies)
        .send({ title: 'User1 Work 2' });

      await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', user2.allCookies)
        .send({ title: 'User2 Work' });

      const res = await request(app.getHttpServer())
        .get('/works/my')
        .set('Cookie', user1.allCookies)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(2);
      res.body.forEach((work: { authorId: string }) => {
        expect(work.authorId).toBe(user1.userId);
      });
    });

    it('should return empty array if user has no works', async () => {
      const auth = await registerUser(app, TEST_USER);

      const res = await request(app.getHttpServer())
        .get('/works/my')
        .set('Cookie', auth.allCookies)
        .expect(200);

      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(0);
    });
  });

  describe('GET /works/:id', () => {
    it('should return work details by id', async () => {
      const auth = await registerUser(app, TEST_USER);

      const createRes = await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'Test Work' });
      const workId: string = createRes.body.id;

      const res = await request(app.getHttpServer())
        .get(`/works/${workId}`)
        .expect(200);

      expect(res.body.id).toBe(workId);
      expect(res.body.author.id).toBe(auth.userId);
    });

    it('should return 404 if work does not exist', () => {
      return request(app.getHttpServer())
        .get('/works/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('should be accessible without authentication', async () => {
      const auth = await registerUser(app, TEST_USER);

      const createRes = await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'Public Work' });
      const workId: string = createRes.body.id;

      return request(app.getHttpServer()).get(`/works/${workId}`).expect(200);
    });
  });

  describe('PATCH /works/:id', () => {
    it('should return 401 if not authenticated', () => {
      return request(app.getHttpServer())
        .patch('/works/00000000-0000-0000-0000-000000000000')
        .send({ title: 'X' })
        .expect(401);
    });

    it('should update work title as owner', async () => {
      const auth = await registerUser(app, TEST_USER);

      const createRes = await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'Original Title' });
      const workId: string = createRes.body.id;

      const res = await request(app.getHttpServer())
        .patch(`/works/${workId}`)
        .set('Cookie', auth.allCookies)
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(res.body.title).toBe('Updated Title');
    });

    it('should update allowCollaboration flag', async () => {
      const auth = await registerUser(app, TEST_USER);

      const createRes = await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'Collab Work', allowCollaboration: true });
      const workId: string = createRes.body.id;

      const res = await request(app.getHttpServer())
        .patch(`/works/${workId}`)
        .set('Cookie', auth.allCookies)
        .send({ allowCollaboration: false })
        .expect(200);

      expect(res.body.allowCollaboration).toBe(false);
    });

    it('should return 403 if not the owner', async () => {
      const user1 = await registerUser(app, TEST_USER);
      const user2 = await registerUser(app, TEST_USER_2);

      const createRes = await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', user1.allCookies)
        .send({ title: 'Owner Work' });
      const workId: string = createRes.body.id;

      return request(app.getHttpServer())
        .patch(`/works/${workId}`)
        .set('Cookie', user2.allCookies)
        .send({ title: 'Stolen Update' })
        .expect(403);
    });

    it('should return 404 if work does not exist', async () => {
      const auth = await registerUser(app, TEST_USER);

      return request(app.getHttpServer())
        .patch('/works/00000000-0000-0000-0000-000000000000')
        .set('Cookie', auth.allCookies)
        .send({ title: 'Valid Title' })
        .expect(404);
    });

    it('should update genre to a valid value', async () => {
      const auth = await registerUser(app, TEST_USER);

      const createRes = await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'Genre Update Work' });
      const workId: string = createRes.body.id;

      const res = await request(app.getHttpServer())
        .patch(`/works/${workId}`)
        .set('Cookie', auth.allCookies)
        .send({ genre: 'mystery' })
        .expect(200);

      expect(res.body.genre).toBe('mystery');
    });

    it('should return 400 when updating with invalid genre', async () => {
      const auth = await registerUser(app, TEST_USER);

      const createRes = await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'Genre Update Work 2' });
      const workId: string = createRes.body.id;

      return request(app.getHttpServer())
        .patch(`/works/${workId}`)
        .set('Cookie', auth.allCookies)
        .send({ genre: 'not-a-genre' })
        .expect(400);
    });
  });

  describe('GET /works — genre filtering', () => {
    it('should return only works matching the requested genre', async () => {
      const auth = await registerUser(app, TEST_USER);

      await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'Horror Story', genre: 'horror' });

      await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'Mystery Story', genre: 'mystery' });

      const res = await request(app.getHttpServer())
        .get('/works?genre=horror')
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.total).toBe(1);
      expect(res.body.data[0].genre).toBe('horror');
    });

    it('should return empty array when no works match the genre', async () => {
      const auth = await registerUser(app, TEST_USER);

      await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'Fantasy Story', genre: 'fantasy' });

      const res = await request(app.getHttpServer())
        .get('/works?genre=horror')
        .expect(200);

      expect(res.body.data.length).toBe(0);
      expect(res.body.total).toBe(0);
    });

    it('should return all works when no genre param is provided', async () => {
      const auth = await registerUser(app, TEST_USER);

      await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'Horror Story', genre: 'horror' });

      await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'Fantasy Story', genre: 'fantasy' });

      await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'No Genre Story' });

      const res = await request(app.getHttpServer()).get('/works').expect(200);

      expect(res.body.data.length).toBe(3);
      expect(res.body.total).toBe(3);
    });
  });

  describe('DELETE /works/:id', () => {
    it('should return 401 if not authenticated', () => {
      return request(app.getHttpServer())
        .delete('/works/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });

    it('should delete work as owner', async () => {
      const auth = await registerUser(app, TEST_USER);

      const createRes = await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', auth.allCookies)
        .send({ title: 'Work to Delete' });
      const workId: string = createRes.body.id;

      const res = await request(app.getHttpServer())
        .delete(`/works/${workId}`)
        .set('Cookie', auth.allCookies)
        .expect(200);

      expect(res.body.message).toBe('Work deleted successfully');

      await request(app.getHttpServer()).get(`/works/${workId}`).expect(404);
    });

    it('should return 403 if not the owner', async () => {
      const user1 = await registerUser(app, TEST_USER);
      const user2 = await registerUser(app, TEST_USER_2);

      const createRes = await request(app.getHttpServer())
        .post('/works')
        .set('Cookie', user1.allCookies)
        .send({ title: 'Owner Work' });
      const workId: string = createRes.body.id;

      return request(app.getHttpServer())
        .delete(`/works/${workId}`)
        .set('Cookie', user2.allCookies)
        .expect(403);
    });

    it('should return 404 if work does not exist', async () => {
      const auth = await registerUser(app, TEST_USER);

      return request(app.getHttpServer())
        .delete('/works/00000000-0000-0000-0000-000000000000')
        .set('Cookie', auth.allCookies)
        .expect(404);
    });
  });
});
