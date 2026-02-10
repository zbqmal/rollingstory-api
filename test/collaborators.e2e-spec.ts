/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Collaborators (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let ownerUserId: string;
  let collaboratorToken: string;
  let collaboratorUserId: string;
  let thirdUserToken: string;
  let thirdUserId: string;
  let workId: string;
  let noCollabWorkId: string;

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

    // Create owner user
    const ownerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'owner@example.com',
        username: 'owner',
        password: 'password123',
      });
    ownerToken = ownerRes.body.token;
    ownerUserId = ownerRes.body.user.id;

    // Create collaborator user
    const collabRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'collab@example.com',
        username: 'collaborator',
        password: 'password123',
      });
    collaboratorToken = collabRes.body.token;
    collaboratorUserId = collabRes.body.user.id;

    // Create third user
    const thirdRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'third@example.com',
        username: 'thirduser',
        password: 'password123',
      });
    thirdUserToken = thirdRes.body.token;
    thirdUserId = thirdRes.body.user.id;

    // Create a work with collaboration enabled
    const workRes = await request(app.getHttpServer())
      .post('/works')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Collaborative Work',
        description: 'A work that allows collaboration',
        pageCharLimit: 1000,
        allowCollaboration: true,
      });
    workId = workRes.body.id;

    // Create a work with collaboration disabled
    const noCollabWorkRes = await request(app.getHttpServer())
      .post('/works')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'No Collaboration Work',
        description: 'A work that does not allow collaboration',
        pageCharLimit: 1000,
        allowCollaboration: false,
      });
    noCollabWorkId = noCollabWorkRes.body.id;
  });

  describe('POST /works/:workId/collaborators/request', () => {
    it('should create a pending collaboration request', async () => {
      const res = await request(app.getHttpServer())
        .post(`/works/${workId}/collaborators/request`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.workId).toBe(workId);
      expect(res.body.userId).toBe(collaboratorUserId);
      expect(res.body.approvedAt).toBeNull();
      expect(res.body.user).toHaveProperty('username', 'collaborator');
    });

    it('should fail if work does not exist', async () => {
      await request(app.getHttpServer())
        .post('/works/non-existent-work/collaborators/request')
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .expect(404);
    });

    it('should fail if collaboration is not allowed', async () => {
      await request(app.getHttpServer())
        .post(`/works/${noCollabWorkId}/collaborators/request`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .expect(403);
    });

    it('should fail if user is the work owner', async () => {
      await request(app.getHttpServer())
        .post(`/works/${workId}/collaborators/request`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403);
    });

    it('should fail if user already has a pending request', async () => {
      // First request
      await request(app.getHttpServer())
        .post(`/works/${workId}/collaborators/request`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .expect(201);

      // Duplicate request
      await request(app.getHttpServer())
        .post(`/works/${workId}/collaborators/request`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .expect(409);
    });

    it('should fail if user is already an approved collaborator', async () => {
      // Create approved collaborator directly
      await prisma.workCollaborator.create({
        data: {
          workId,
          userId: collaboratorUserId,
          approvedAt: new Date(),
        },
      });

      await request(app.getHttpServer())
        .post(`/works/${workId}/collaborators/request`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .expect(403);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post(`/works/${workId}/collaborators/request`)
        .expect(401);
    });
  });

  describe('POST /works/:workId/collaborators/:userId/approve', () => {
    beforeEach(async () => {
      // Create a pending request
      await prisma.workCollaborator.create({
        data: {
          workId,
          userId: collaboratorUserId,
          approvedAt: null,
        },
      });
    });

    it('should approve a pending collaboration request', async () => {
      const res = await request(app.getHttpServer())
        .post(`/works/${workId}/collaborators/${collaboratorUserId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      expect(res.body.approvedAt).toBeTruthy();
      expect(res.body.userId).toBe(collaboratorUserId);
    });

    it('should fail if user is not the work owner', async () => {
      await request(app.getHttpServer())
        .post(`/works/${workId}/collaborators/${collaboratorUserId}/approve`)
        .set('Authorization', `Bearer ${thirdUserToken}`)
        .expect(403);
    });

    it('should fail if collaboration request does not exist', async () => {
      await request(app.getHttpServer())
        .post(`/works/${workId}/collaborators/${thirdUserId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });

    it('should fail if request is already approved', async () => {
      // Approve first time
      await request(app.getHttpServer())
        .post(`/works/${workId}/collaborators/${collaboratorUserId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      // Try to approve again
      await request(app.getHttpServer())
        .post(`/works/${workId}/collaborators/${collaboratorUserId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(409);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post(`/works/${workId}/collaborators/${collaboratorUserId}/approve`)
        .expect(401);
    });
  });

  describe('DELETE /works/:workId/collaborators/:userId', () => {
    beforeEach(async () => {
      // Create an approved collaborator
      await prisma.workCollaborator.create({
        data: {
          workId,
          userId: collaboratorUserId,
          approvedAt: new Date(),
        },
      });
    });

    it('should remove a collaborator', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/works/${workId}/collaborators/${collaboratorUserId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.message).toBe('Collaborator removed successfully');

      // Verify collaborator was removed
      const collaborator = await prisma.workCollaborator.findUnique({
        where: {
          workId_userId: {
            workId,
            userId: collaboratorUserId,
          },
        },
      });
      expect(collaborator).toBeNull();
    });

    it('should fail if user is not the work owner', async () => {
      await request(app.getHttpServer())
        .delete(`/works/${workId}/collaborators/${collaboratorUserId}`)
        .set('Authorization', `Bearer ${thirdUserToken}`)
        .expect(403);
    });

    it('should fail if collaborator does not exist', async () => {
      await request(app.getHttpServer())
        .delete(`/works/${workId}/collaborators/${thirdUserId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .delete(`/works/${workId}/collaborators/${collaboratorUserId}`)
        .expect(401);
    });
  });

  describe('GET /works/:workId/collaborators', () => {
    it('should return only approved collaborators', async () => {
      // Create approved collaborator
      await prisma.workCollaborator.create({
        data: {
          workId,
          userId: collaboratorUserId,
          approvedAt: new Date(),
        },
      });

      // Create pending collaborator
      await prisma.workCollaborator.create({
        data: {
          workId,
          userId: thirdUserId,
          approvedAt: null,
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/works/${workId}/collaborators`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].userId).toBe(collaboratorUserId);
      expect(res.body[0].approvedAt).toBeTruthy();
      expect(res.body[0].user).toHaveProperty('username', 'collaborator');
    });

    it('should return empty array if no approved collaborators', async () => {
      const res = await request(app.getHttpServer())
        .get(`/works/${workId}/collaborators`)
        .expect(200);

      expect(res.body).toHaveLength(0);
    });

    it('should work without authentication (public endpoint)', async () => {
      await request(app.getHttpServer())
        .get(`/works/${workId}/collaborators`)
        .expect(200);
    });
  });

  describe('GET /works/:workId/collaborators/pending', () => {
    it('should return only pending requests for work owner', async () => {
      // Create pending request
      await prisma.workCollaborator.create({
        data: {
          workId,
          userId: collaboratorUserId,
          approvedAt: null,
        },
      });

      // Create approved collaborator
      await prisma.workCollaborator.create({
        data: {
          workId,
          userId: thirdUserId,
          approvedAt: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/works/${workId}/collaborators/pending`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].userId).toBe(collaboratorUserId);
      expect(res.body[0].approvedAt).toBeNull();
      expect(res.body[0].user).toHaveProperty('username', 'collaborator');
    });

    it('should fail if user is not the work owner', async () => {
      await request(app.getHttpServer())
        .get(`/works/${workId}/collaborators/pending`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .expect(403);
    });

    it('should return empty array if no pending requests', async () => {
      const res = await request(app.getHttpServer())
        .get(`/works/${workId}/collaborators/pending`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body).toHaveLength(0);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .get(`/works/${workId}/collaborators/pending`)
        .expect(401);
    });
  });

  describe('Integration: Approved collaborator can add pages', () => {
    it('should allow approved collaborator to add pages', async () => {
      // Request collaboration
      await request(app.getHttpServer())
        .post(`/works/${workId}/collaborators/request`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .expect(201);

      // Approve collaboration
      await request(app.getHttpServer())
        .post(`/works/${workId}/collaborators/${collaboratorUserId}/approve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(201);

      // Try to add a page as collaborator
      const pageRes = await request(app.getHttpServer())
        .post(`/works/${workId}/pages`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({
          content: 'Page content by collaborator',
        })
        .expect(201);

      expect(pageRes.body.authorId).toBe(collaboratorUserId);
      expect(pageRes.body.content).toBe('Page content by collaborator');
    });

    it('should not allow non-approved user to add pages', async () => {
      // Request collaboration but don't approve
      await request(app.getHttpServer())
        .post(`/works/${workId}/collaborators/request`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .expect(201);

      // Try to add a page as pending collaborator
      await request(app.getHttpServer())
        .post(`/works/${workId}/pages`)
        .set('Authorization', `Bearer ${collaboratorToken}`)
        .send({
          content: 'Page content by pending collaborator',
        })
        .expect(403);
    });
  });
});
