/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Works (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let anotherAuthToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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

    // Create test user and get auth token
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
      });
    authToken = registerRes.body.token;
    userId = registerRes.body.user.id;

    // Create another test user
    const anotherRegisterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'another@example.com',
        username: 'anotheruser',
        password: 'password123',
      });
    anotherAuthToken = anotherRegisterRes.body.token;
  });

  describe('/works (POST)', () => {
    it('should create a new work', () => {
      return request(app.getHttpServer())
        .post('/works')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'My First Novel',
          description: 'A great story',
          type: 'novel',
          pageCharLimit: 3000,
          allowCollaboration: true,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.title).toBe('My First Novel');
          expect(res.body.description).toBe('A great story');
          expect(res.body.type).toBe('novel');
          expect(res.body.pageCharLimit).toBe(3000);
          expect(res.body.allowCollaboration).toBe(true);
          expect(res.body.authorId).toBe(userId);
          expect(res.body.author).toBeDefined();
          expect(res.body.author.password).toBeUndefined();
        });
    });

    it('should create work with default values', () => {
      return request(app.getHttpServer())
        .post('/works')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'My Second Novel',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.type).toBe('novel');
          expect(res.body.pageCharLimit).toBe(2000);
          expect(res.body.allowCollaboration).toBe(true);
        });
    });

    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .post('/works')
        .send({
          title: 'My Novel',
        })
        .expect(401);
    });

    it('should return 400 for invalid data', () => {
      return request(app.getHttpServer())
        .post('/works')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'AB', // Too short
        })
        .expect(400);
    });

    it('should return 400 for pageCharLimit out of range', () => {
      return request(app.getHttpServer())
        .post('/works')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'My Novel',
          pageCharLimit: 50, // Too low
        })
        .expect(400);
    });
  });

  describe('/works (GET)', () => {
    beforeEach(async () => {
      // Create some test works
      await request(app.getHttpServer())
        .post('/works')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Work 1' });

      await request(app.getHttpServer())
        .post('/works')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Work 2' });

      await request(app.getHttpServer())
        .post('/works')
        .set('Authorization', `Bearer ${anotherAuthToken}`)
        .send({ title: 'Work 3' });
    });

    it('should return all works with pagination', () => {
      return request(app.getHttpServer())
        .get('/works')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.data.length).toBe(3);
          expect(res.body.total).toBe(3);
          expect(res.body.page).toBe(1);
          expect(res.body.limit).toBe(10);
          expect(res.body.data[0]._count).toBeDefined();
          expect(res.body.data[0]._count.pages).toBe(0);
          expect(res.body.data[0].author).toBeDefined();
          expect(res.body.data[0].author.password).toBeUndefined();
        });
    });

    it('should support pagination parameters', () => {
      return request(app.getHttpServer())
        .get('/works?page=1&limit=2')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBe(2);
          expect(res.body.total).toBe(3);
          expect(res.body.page).toBe(1);
          expect(res.body.limit).toBe(2);
        });
    });
  });

  describe('/works/my (GET)', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/works')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'My Work 1' });

      await request(app.getHttpServer())
        .post('/works')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'My Work 2' });

      await request(app.getHttpServer())
        .post('/works')
        .set('Authorization', `Bearer ${anotherAuthToken}`)
        .send({ title: 'Another Work' });
    });

    it('should return only current user works', () => {
      return request(app.getHttpServer())
        .get('/works/my')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toBeInstanceOf(Array);
          expect(res.body.length).toBe(2);
          expect(res.body[0]._count).toBeDefined();
        });
    });

    it('should return 401 without authentication', () => {
      return request(app.getHttpServer()).get('/works/my').expect(401);
    });
  });

  describe('/works/:id (GET)', () => {
    let workId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/works')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Test Work' });
      workId = res.body.id;
    });

    it('should return a work by id', () => {
      return request(app.getHttpServer())
        .get(`/works/${workId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(workId);
          expect(res.body.title).toBe('Test Work');
          expect(res.body.author).toBeDefined();
          expect(res.body.author.password).toBeUndefined();
          expect(res.body._count).toBeDefined();
        });
    });

    it('should return 404 for non-existent work', () => {
      return request(app.getHttpServer())
        .get('/works/non-existent-id')
        .expect(404);
    });
  });

  describe('/works/:id (PATCH)', () => {
    let workId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/works')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Original Title' });
      workId = res.body.id;
    });

    it('should update a work if user is owner', () => {
      return request(app.getHttpServer())
        .patch(`/works/${workId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Title',
          description: 'Updated Description',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.title).toBe('Updated Title');
          expect(res.body.description).toBe('Updated Description');
        });
    });

    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .patch(`/works/${workId}`)
        .send({ title: 'Updated Title' })
        .expect(401);
    });

    it('should return 403 if user is not owner', () => {
      return request(app.getHttpServer())
        .patch(`/works/${workId}`)
        .set('Authorization', `Bearer ${anotherAuthToken}`)
        .send({ title: 'Updated Title' })
        .expect(403);
    });

    it('should return 404 for non-existent work', () => {
      return request(app.getHttpServer())
        .patch('/works/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Updated Title' })
        .expect(404);
    });
  });

  describe('/works/:id (DELETE)', () => {
    let workId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/works')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Work to Delete' });
      workId = res.body.id;
    });

    it('should delete a work if user is owner', () => {
      return request(app.getHttpServer())
        .delete(`/works/${workId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Work deleted successfully');
        });
    });

    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .delete(`/works/${workId}`)
        .expect(401);
    });

    it('should return 403 if user is not owner', () => {
      return request(app.getHttpServer())
        .delete(`/works/${workId}`)
        .set('Authorization', `Bearer ${anotherAuthToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent work', () => {
      return request(app.getHttpServer())
        .delete('/works/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
