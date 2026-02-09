/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Pages (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let anotherAuthToken: string;
  let anotherUserId: string;
  let workId: string;
  let collaborativeWorkId: string;

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
    anotherUserId = anotherRegisterRes.body.user.id;

    // Create a test work
    const workRes = await request(app.getHttpServer())
      .post('/works')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Novel',
        description: 'A test novel',
        pageCharLimit: 500,
      });
    workId = workRes.body.id;

    // Create a collaborative work
    const collabWorkRes = await request(app.getHttpServer())
      .post('/works')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Collaborative Novel',
        description: 'A collaborative novel',
        pageCharLimit: 1000,
        allowCollaboration: true,
      });
    collaborativeWorkId = collabWorkRes.body.id;

    // Add second user as collaborator
    await prisma.workCollaborator.create({
      data: {
        workId: collaborativeWorkId,
        userId: anotherUserId,
      },
    });
  });

  describe('/works/:workId/pages (POST)', () => {
    it('should create a page as work owner', () => {
      return request(app.getHttpServer())
        .post(`/works/${workId}/pages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'This is the first page of my novel.',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.workId).toBe(workId);
          expect(res.body.content).toBe('This is the first page of my novel.');
          expect(res.body.pageNumber).toBe(1);
          expect(res.body.author).toHaveProperty('username', 'testuser');
          expect(res.body.author).not.toHaveProperty('password');
        });
    });

    it('should create a page as collaborator', () => {
      return request(app.getHttpServer())
        .post(`/works/${collaborativeWorkId}/pages`)
        .set('Authorization', `Bearer ${anotherAuthToken}`)
        .send({
          content: 'I am contributing to this story.',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.workId).toBe(collaborativeWorkId);
          expect(res.body.authorId).toBe(anotherUserId);
          expect(res.body.pageNumber).toBe(1);
        });
    });

    it('should assign sequential page numbers', async () => {
      // Create first page
      await request(app.getHttpServer())
        .post(`/works/${workId}/pages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Page 1' })
        .expect(201);

      // Create second page
      const res = await request(app.getHttpServer())
        .post(`/works/${workId}/pages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Page 2' })
        .expect(201);

      expect(res.body.pageNumber).toBe(2);
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .post(`/works/${workId}/pages`)
        .send({
          content: 'Unauthorized content',
        })
        .expect(401);
    });

    it('should fail if user is not owner or collaborator', () => {
      return request(app.getHttpServer())
        .post(`/works/${workId}/pages`)
        .set('Authorization', `Bearer ${anotherAuthToken}`)
        .send({
          content: 'I should not be able to add this.',
        })
        .expect(403);
    });

    it('should fail if content exceeds character limit', () => {
      const longContent = 'a'.repeat(501);
      return request(app.getHttpServer())
        .post(`/works/${workId}/pages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: longContent,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('character limit');
        });
    });

    it('should fail if work does not exist', () => {
      return request(app.getHttpServer())
        .post('/works/non-existent-id/pages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Content',
        })
        .expect(404);
    });
  });

  describe('/works/:workId/pages (GET)', () => {
    it('should return all pages for a work', async () => {
      // Create multiple pages
      await request(app.getHttpServer())
        .post(`/works/${workId}/pages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Page 1' });

      await request(app.getHttpServer())
        .post(`/works/${workId}/pages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Page 2' });

      return request(app.getHttpServer())
        .get(`/works/${workId}/pages`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body).toHaveLength(2);
          expect(res.body[0].pageNumber).toBe(1);
          expect(res.body[1].pageNumber).toBe(2);
          expect(res.body[0].content).toBe('Page 1');
          expect(res.body[1].content).toBe('Page 2');
        });
    });

    it('should return empty array if work has no pages', () => {
      return request(app.getHttpServer())
        .get(`/works/${workId}/pages`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body).toHaveLength(0);
        });
    });

    it('should not require authentication', () => {
      return request(app.getHttpServer())
        .get(`/works/${workId}/pages`)
        .expect(200);
    });
  });

  describe('/works/:workId/pages/:number (GET)', () => {
    it('should return a specific page', async () => {
      await request(app.getHttpServer())
        .post(`/works/${workId}/pages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Page 1' });

      await request(app.getHttpServer())
        .post(`/works/${workId}/pages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Page 2' });

      return request(app.getHttpServer())
        .get(`/works/${workId}/pages/2`)
        .expect(200)
        .expect((res) => {
          expect(res.body.pageNumber).toBe(2);
          expect(res.body.content).toBe('Page 2');
          expect(res.body.author).toHaveProperty('username');
        });
    });

    it('should fail if page does not exist', () => {
      return request(app.getHttpServer())
        .get(`/works/${workId}/pages/999`)
        .expect(404);
    });

    it('should not require authentication', () => {
      return request(app.getHttpServer())
        .get(`/works/${workId}/pages/1`)
        .expect(404); // 404 because page doesn't exist, not 401
    });
  });

  describe('/pages/:id (PATCH)', () => {
    let pageId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post(`/works/${workId}/pages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Original content' });
      pageId = res.body.id;
    });

    it('should update page content', () => {
      return request(app.getHttpServer())
        .patch(`/pages/${pageId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Updated content' })
        .expect(200)
        .expect((res) => {
          expect(res.body.content).toBe('Updated content');
          expect(res.body.id).toBe(pageId);
        });
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .patch(`/pages/${pageId}`)
        .send({ content: 'Updated content' })
        .expect(401);
    });

    it('should fail if user is not the page author', () => {
      return request(app.getHttpServer())
        .patch(`/pages/${pageId}`)
        .set('Authorization', `Bearer ${anotherAuthToken}`)
        .send({ content: 'Hacked content' })
        .expect(403);
    });

    it('should fail if content exceeds character limit', () => {
      const longContent = 'a'.repeat(501);
      return request(app.getHttpServer())
        .patch(`/pages/${pageId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: longContent })
        .expect(400);
    });

    it('should fail if page does not exist', () => {
      return request(app.getHttpServer())
        .patch('/pages/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Content' })
        .expect(404);
    });
  });

  describe('/pages/:id (DELETE)', () => {
    let page1Id: string;
    let page2Id: string;
    let page3Id: string;

    beforeEach(async () => {
      const res1 = await request(app.getHttpServer())
        .post(`/works/${workId}/pages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Page 1' });
      page1Id = res1.body.id;

      const res2 = await request(app.getHttpServer())
        .post(`/works/${workId}/pages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Page 2' });
      page2Id = res2.body.id;

      const res3 = await request(app.getHttpServer())
        .post(`/works/${workId}/pages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Page 3' });
      page3Id = res3.body.id;
    });

    it('should delete a page', () => {
      return request(app.getHttpServer())
        .delete(`/pages/${page1Id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toContain('deleted successfully');
        });
    });

    it('should reorder subsequent pages after deletion', async () => {
      // Delete page 2
      await request(app.getHttpServer())
        .delete(`/pages/${page2Id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Get all pages
      const res = await request(app.getHttpServer())
        .get(`/works/${workId}/pages`)
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body[0].pageNumber).toBe(1);
      expect(res.body[0].content).toBe('Page 1');
      expect(res.body[1].pageNumber).toBe(2); // Was page 3, now page 2
      expect(res.body[1].content).toBe('Page 3');
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .delete(`/pages/${page1Id}`)
        .expect(401);
    });

    it('should fail if user is not the page author', () => {
      return request(app.getHttpServer())
        .delete(`/pages/${page1Id}`)
        .set('Authorization', `Bearer ${anotherAuthToken}`)
        .expect(403);
    });

    it('should fail if page does not exist', () => {
      return request(app.getHttpServer())
        .delete('/pages/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
