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

describe('Pages (e2e)', () => {
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

  // Helper: create a work for a user (returns the work body)
  async function createWork(
    allCookies: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await request(app.getHttpServer())
      .post('/works')
      .set('Cookie', allCookies)
      .send({ title: 'Test Work', allowCollaboration: true, ...overrides })
      .expect(201);
    return res.body as {
      id: string;
      authorId: string;
      pageCharLimit: number;
      allowCollaboration: boolean;
    };
  }

  // Helper: create a page for a work (returns the page body)
  async function createPage(
    workId: string,
    allCookies: string,
    content = 'Page content',
  ) {
    const res = await request(app.getHttpServer())
      .post(`/works/${workId}/pages`)
      .set('Cookie', allCookies)
      .send({ content })
      .expect(201);
    return res.body as {
      id: string;
      status: string;
      pageNumber: number | null;
    };
  }

  describe('POST /works/:workId/pages', () => {
    it('should return 401 if not authenticated', async () => {
      const owner = await registerUser(app, TEST_USER);
      const work = await createWork(owner.allCookies);

      return request(app.getHttpServer())
        .post(`/works/${work.id}/pages`)
        .send({ content: 'Hello world' })
        .expect(401);
    });

    it('should create a page with status approved when owner posts', async () => {
      const owner = await registerUser(app, TEST_USER);
      const work = await createWork(owner.allCookies);

      const res = await request(app.getHttpServer())
        .post(`/works/${work.id}/pages`)
        .set('Cookie', owner.allCookies)
        .send({ content: 'Hello world' })
        .expect(201);

      expect(res.body.status).toBe('approved');
      expect(res.body.pageNumber).toBe(1);
      expect(res.body.approvedAt).toBeDefined();
    });

    it('should assign sequential page numbers to owner pages', async () => {
      const owner = await registerUser(app, TEST_USER);
      const work = await createWork(owner.allCookies);

      const page1 = await createPage(work.id, owner.allCookies, 'Page 1');
      const page2 = await createPage(work.id, owner.allCookies, 'Page 2');
      const page3 = await createPage(work.id, owner.allCookies, 'Page 3');

      expect(page1.pageNumber).toBe(1);
      expect(page2.pageNumber).toBe(2);
      expect(page3.pageNumber).toBe(3);
    });

    it('should create a page with status pending when non-owner contributes', async () => {
      const owner = await registerUser(app, TEST_USER);
      const work = await createWork(owner.allCookies, {
        allowCollaboration: true,
      });
      const contributor = await registerUser(app, TEST_USER_2);

      const res = await request(app.getHttpServer())
        .post(`/works/${work.id}/pages`)
        .set('Cookie', contributor.allCookies)
        .send({ content: 'Contribution' })
        .expect(201);

      expect(res.body.status).toBe('pending');
      expect(res.body.pageNumber).toBeNull();
    });

    it('should return 403 if collaboration is disabled and user is not owner', async () => {
      const owner = await registerUser(app, TEST_USER);
      const work = await createWork(owner.allCookies, {
        allowCollaboration: false,
      });
      const other = await registerUser(app, TEST_USER_2);

      return request(app.getHttpServer())
        .post(`/works/${work.id}/pages`)
        .set('Cookie', other.allCookies)
        .send({ content: 'Contribution' })
        .expect(403);
    });

    it('should return 400 if content exceeds pageCharLimit', async () => {
      const owner = await registerUser(app, TEST_USER);
      const work = await createWork(owner.allCookies, { pageCharLimit: 100 });

      return request(app.getHttpServer())
        .post(`/works/${work.id}/pages`)
        .set('Cookie', owner.allCookies)
        .send({ content: 'a'.repeat(101) })
        .expect(400);
    });

    it('should return 400 if content is empty', async () => {
      const owner = await registerUser(app, TEST_USER);
      const work = await createWork(owner.allCookies);

      return request(app.getHttpServer())
        .post(`/works/${work.id}/pages`)
        .set('Cookie', owner.allCookies)
        .send({ content: '' })
        .expect(400);
    });

    it('should return 404 if work does not exist', async () => {
      const owner = await registerUser(app, TEST_USER);

      return request(app.getHttpServer())
        .post('/works/00000000-0000-0000-0000-000000000000/pages')
        .set('Cookie', owner.allCookies)
        .send({ content: 'hello' })
        .expect(404);
    });
  });

  describe('GET /works/:workId/pages', () => {
    it('should return empty array when work has no approved pages', async () => {
      const owner = await registerUser(app, TEST_USER);
      const work = await createWork(owner.allCookies);

      const res = await request(app.getHttpServer())
        .get(`/works/${work.id}/pages`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('should return only approved pages', async () => {
      const owner = await registerUser(app, TEST_USER);
      const work = await createWork(owner.allCookies, {
        allowCollaboration: true,
      });
      const contributor = await registerUser(app, TEST_USER_2);

      await createPage(work.id, owner.allCookies, 'Approved 1');
      await createPage(work.id, owner.allCookies, 'Approved 2');

      await request(app.getHttpServer())
        .post(`/works/${work.id}/pages`)
        .set('Cookie', contributor.allCookies)
        .send({ content: 'Pending contribution' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/works/${work.id}/pages`)
        .expect(200);

      const pages = res.body as { status: string }[];
      expect(pages).toHaveLength(2);
      pages.forEach((page) => {
        expect(page.status).toBe('approved');
      });
    });

    it('should return pages ordered by pageNumber ascending', async () => {
      const owner = await registerUser(app, TEST_USER);
      const work = await createWork(owner.allCookies);

      await createPage(work.id, owner.allCookies, 'Page 1');
      await createPage(work.id, owner.allCookies, 'Page 2');
      await createPage(work.id, owner.allCookies, 'Page 3');

      const res = await request(app.getHttpServer())
        .get(`/works/${work.id}/pages`)
        .expect(200);

      expect(res.body[0].pageNumber).toBe(1);
      expect(res.body[1].pageNumber).toBe(2);
      expect(res.body[2].pageNumber).toBe(3);
    });

    it('should be accessible without authentication', async () => {
      const owner = await registerUser(app, TEST_USER);
      const work = await createWork(owner.allCookies);
      await createPage(work.id, owner.allCookies);

      return request(app.getHttpServer())
        .get(`/works/${work.id}/pages`)
        .expect(200);
    });
  });

  describe('GET /works/:workId/pages/pending', () => {
    it('should return 401 if not authenticated', async () => {
      const owner = await registerUser(app, TEST_USER);
      const work = await createWork(owner.allCookies);

      return request(app.getHttpServer())
        .get(`/works/${work.id}/pages/pending`)
        .expect(401);
    });

    it('should return pending contributions as work owner', async () => {
      const owner = await registerUser(app, TEST_USER);
      const work = await createWork(owner.allCookies, {
        allowCollaboration: true,
      });
      const contributor = await registerUser(app, TEST_USER_2);

      await request(app.getHttpServer())
        .post(`/works/${work.id}/pages`)
        .set('Cookie', contributor.allCookies)
        .send({ content: 'Contribution 1' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/works/${work.id}/pages`)
        .set('Cookie', contributor.allCookies)
        .send({ content: 'Contribution 2' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/works/${work.id}/pages/pending`)
        .set('Cookie', owner.allCookies)
        .expect(200);

      const pages = res.body as { status: string }[];
      expect(pages).toHaveLength(2);
      pages.forEach((page) => {
        expect(page.status).toBe('pending');
      });
    });

    it('should return contributor own pending pages when called by a contributor', async () => {
      const owner = await registerUser(app, TEST_USER);
      const work = await createWork(owner.allCookies, {
        allowCollaboration: true,
      });
      const contributor = await registerUser(app, TEST_USER_2);

      await request(app.getHttpServer())
        .post(`/works/${work.id}/pages`)
        .set('Cookie', contributor.allCookies)
        .send({ content: 'My contribution' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/works/${work.id}/pages/pending`)
        .set('Cookie', contributor.allCookies)
        .expect(200);

      const pages = res.body as { status: string; authorId: string }[];
      expect(pages).toHaveLength(1);
      expect(pages[0].status).toBe('pending');
      expect(pages[0].authorId).toBe(contributor.userId);
    });

    it('should return 200 with empty array for authenticated user with no pending pages', async () => {
      const owner = await registerUser(app, TEST_USER);
      const work = await createWork(owner.allCookies);
      const other = await registerUser(app, TEST_USER_2);

      const res = await request(app.getHttpServer())
        .get(`/works/${work.id}/pages/pending`)
        .set('Cookie', other.allCookies)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('should return empty array when there are no pending contributions', async () => {
      const owner = await registerUser(app, TEST_USER);
      const work = await createWork(owner.allCookies);

      const res = await request(app.getHttpServer())
        .get(`/works/${work.id}/pages/pending`)
        .set('Cookie', owner.allCookies)
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('GET /works/:workId/pages/:number', () => {
    it('should return a specific approved page by number', async () => {
      const owner = await registerUser(app, TEST_USER);
      const work = await createWork(owner.allCookies);

      await createPage(work.id, owner.allCookies, 'First page');
      await createPage(work.id, owner.allCookies, 'Second page');

      const res1 = await request(app.getHttpServer())
        .get(`/works/${work.id}/pages/1`)
        .expect(200);
      expect(res1.body.pageNumber).toBe(1);

      const res2 = await request(app.getHttpServer())
        .get(`/works/${work.id}/pages/2`)
        .expect(200);
      expect(res2.body.pageNumber).toBe(2);
    });

    describe('GET /works/:workId/pages/:number', () => {
      it('should return a specific approved page by number', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies);

        await createPage(work.id, owner.allCookies, 'First page');
        await createPage(work.id, owner.allCookies, 'Second page');

        const res1 = await request(app.getHttpServer())
          .get(`/works/${work.id}/pages/1`)
          .expect(200);
        expect(res1.body.pageNumber).toBe(1);

        const res2 = await request(app.getHttpServer())
          .get(`/works/${work.id}/pages/2`)
          .expect(200);
        expect(res2.body.pageNumber).toBe(2);
      });

      it('should return 404 if page number does not exist', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies);

        return request(app.getHttpServer())
          .get(`/works/${work.id}/pages/99`)
          .expect(404);
      });

      it('should be accessible without authentication', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies);
        await createPage(work.id, owner.allCookies);

        return request(app.getHttpServer())
          .get(`/works/${work.id}/pages/1`)
          .expect(200);
      });

      it('should return 400 when page number is not a valid integer', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies);

        return request(app.getHttpServer())
          .get(`/works/${work.id}/pages/abc`)
          .expect(400);
      });
    });

    describe('PATCH /pages/:id', () => {
      it('should return 401 if not authenticated', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies);
        const page = await createPage(work.id, owner.allCookies);

        return request(app.getHttpServer())
          .patch(`/pages/${page.id}`)
          .send({ content: 'Updated content' })
          .expect(401);
      });

      it('should update page content as the page author', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies);
        const page = await createPage(work.id, owner.allCookies);

        const res = await request(app.getHttpServer())
          .patch(`/pages/${page.id}`)
          .set('Cookie', owner.allCookies)
          .send({ content: 'Updated content' })
          .expect(200);

        expect(res.body.content).toBe('Updated content');
      });

      it('should return 403 if not the page author', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies);
        const page = await createPage(work.id, owner.allCookies);
        const other = await registerUser(app, TEST_USER_2);

        return request(app.getHttpServer())
          .patch(`/pages/${page.id}`)
          .set('Cookie', other.allCookies)
          .send({ content: 'Hacked content' })
          .expect(403);
      });

      it('should return 400 if updated content exceeds pageCharLimit', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies, { pageCharLimit: 100 });
        const page = await createPage(work.id, owner.allCookies, 'Short');

        return request(app.getHttpServer())
          .patch(`/pages/${page.id}`)
          .set('Cookie', owner.allCookies)
          .send({ content: 'a'.repeat(101) })
          .expect(400);
      });

      it('should return 404 if page does not exist', async () => {
        const owner = await registerUser(app, TEST_USER);

        return request(app.getHttpServer())
          .patch('/pages/00000000-0000-0000-0000-000000000000')
          .set('Cookie', owner.allCookies)
          .send({ content: 'hello' })
          .expect(404);
      });

      it('should return 403 when trying to update a pending page', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies, {
          allowCollaboration: true,
        });
        const contributor = await registerUser(app, TEST_USER_2);

        const pendingPage = await request(app.getHttpServer())
          .post(`/works/${work.id}/pages`)
          .set('Cookie', contributor.allCookies)
          .send({ content: 'Pending contribution' })
          .expect(201);

        return request(app.getHttpServer())
          .patch(`/pages/${pendingPage.body.id}`)
          .set('Cookie', contributor.allCookies)
          .send({ content: 'Updated content' })
          .expect(403);
      });
    });

    describe('DELETE /pages/:id', () => {
      it('should return 401 if not authenticated', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies);
        const page = await createPage(work.id, owner.allCookies);

        return request(app.getHttpServer())
          .delete(`/pages/${page.id}`)
          .expect(401);
      });

      it('should delete a page as the author and reorder subsequent pages', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies);

        const page1 = await createPage(work.id, owner.allCookies, 'Page 1');
        const page2 = await createPage(work.id, owner.allCookies, 'Page 2');
        await createPage(work.id, owner.allCookies, 'Page 3');

        const deleteRes = await request(app.getHttpServer())
          .delete(`/pages/${page2.id}`)
          .set('Cookie', owner.allCookies)
          .expect(200);

        expect(deleteRes.body.message).toBe('Page deleted successfully');

        const listRes = await request(app.getHttpServer())
          .get(`/works/${work.id}/pages`)
          .expect(200);

        expect(listRes.body).toHaveLength(2);
        expect(listRes.body[0].pageNumber).toBe(1);
        expect(listRes.body[0].id).toBe(page1.id);
        expect(listRes.body[1].pageNumber).toBe(2);
      });

      it('should return 403 if not the page author', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies);
        const page = await createPage(work.id, owner.allCookies);
        const other = await registerUser(app, TEST_USER_2);

        return request(app.getHttpServer())
          .delete(`/pages/${page.id}`)
          .set('Cookie', other.allCookies)
          .expect(403);
      });

      it('should return 404 if page does not exist', async () => {
        const owner = await registerUser(app, TEST_USER);

        return request(app.getHttpServer())
          .delete('/pages/00000000-0000-0000-0000-000000000000')
          .set('Cookie', owner.allCookies)
          .expect(404);
      });

      it('should return 403 when trying to delete a pending page', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies, {
          allowCollaboration: true,
        });
        const contributor = await registerUser(app, TEST_USER_2);

        const pendingPage = await request(app.getHttpServer())
          .post(`/works/${work.id}/pages`)
          .set('Cookie', contributor.allCookies)
          .send({ content: 'Pending contribution' })
          .expect(201);

        return request(app.getHttpServer())
          .delete(`/pages/${pendingPage.body.id}`)
          .set('Cookie', contributor.allCookies)
          .expect(403);
      });
    });

    describe('POST /pages/:id/approve', () => {
      it('should return 401 if not authenticated', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies, {
          allowCollaboration: true,
        });
        const contributor = await registerUser(app, TEST_USER_2);

        const pendingPage = await request(app.getHttpServer())
          .post(`/works/${work.id}/pages`)
          .set('Cookie', contributor.allCookies)
          .send({ content: 'Pending contribution' })
          .expect(201);

        return request(app.getHttpServer())
          .post(`/pages/${pendingPage.body.id}/approve`)
          .expect(401);
      });

      it('should approve a pending contribution as work owner', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies, {
          allowCollaboration: true,
        });
        const contributor = await registerUser(app, TEST_USER_2);

        const pendingPage = await request(app.getHttpServer())
          .post(`/works/${work.id}/pages`)
          .set('Cookie', contributor.allCookies)
          .send({ content: 'Pending contribution' })
          .expect(201);

        const res = await request(app.getHttpServer())
          .post(`/pages/${pendingPage.body.id}/approve`)
          .set('Cookie', owner.allCookies)
          .expect(200);

        expect(res.body.status).toBe('approved');
        expect(res.body.pageNumber).toBeGreaterThanOrEqual(1);
        expect(res.body.approvedAt).toBeDefined();
      });

      it('should assign correct page number to approved contribution (after existing approved pages)', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies, {
          allowCollaboration: true,
        });
        const contributor = await registerUser(app, TEST_USER_2);

        await createPage(work.id, owner.allCookies, 'Owner page 1');
        await createPage(work.id, owner.allCookies, 'Owner page 2');

        const pendingPage = await request(app.getHttpServer())
          .post(`/works/${work.id}/pages`)
          .set('Cookie', contributor.allCookies)
          .send({ content: 'Pending contribution' })
          .expect(201);

        const res = await request(app.getHttpServer())
          .post(`/pages/${pendingPage.body.id}/approve`)
          .set('Cookie', owner.allCookies)
          .expect(200);

        expect(res.body.pageNumber).toBe(3);
      });

      it('should return 403 if not the work owner', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies, {
          allowCollaboration: true,
        });
        const contributor = await registerUser(app, TEST_USER_2);

        const pendingPage = await request(app.getHttpServer())
          .post(`/works/${work.id}/pages`)
          .set('Cookie', contributor.allCookies)
          .send({ content: 'Pending contribution' })
          .expect(201);

        return request(app.getHttpServer())
          .post(`/pages/${pendingPage.body.id}/approve`)
          .set('Cookie', contributor.allCookies)
          .expect(403);
      });

      it('should return 400 if page is already approved', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies);
        const page = await createPage(work.id, owner.allCookies);

        return request(app.getHttpServer())
          .post(`/pages/${page.id}/approve`)
          .set('Cookie', owner.allCookies)
          .expect(400);
      });

      it('should return 404 if page does not exist', async () => {
        const owner = await registerUser(app, TEST_USER);
        await createWork(owner.allCookies);

        return request(app.getHttpServer())
          .post('/pages/00000000-0000-0000-0000-000000000000/approve')
          .set('Cookie', owner.allCookies)
          .expect(404);
      });
    });

    describe('DELETE /pages/:id/reject', () => {
      it('should return 401 if not authenticated', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies, {
          allowCollaboration: true,
        });
        const contributor = await registerUser(app, TEST_USER_2);

        const pendingPage = await request(app.getHttpServer())
          .post(`/works/${work.id}/pages`)
          .set('Cookie', contributor.allCookies)
          .send({ content: 'Pending contribution' })
          .expect(201);

        return request(app.getHttpServer())
          .delete(`/pages/${pendingPage.body.id}/reject`)
          .expect(401);
      });

      it('should reject and permanently delete a pending contribution as work owner', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies, {
          allowCollaboration: true,
        });
        const contributor = await registerUser(app, TEST_USER_2);

        const pendingPage = await request(app.getHttpServer())
          .post(`/works/${work.id}/pages`)
          .set('Cookie', contributor.allCookies)
          .send({ content: 'Pending contribution' })
          .expect(201);

        const res = await request(app.getHttpServer())
          .delete(`/pages/${pendingPage.body.id}/reject`)
          .set('Cookie', owner.allCookies)
          .expect(200);

        expect(res.body.message).toBe(
          'Contribution rejected and deleted successfully',
        );

        const pendingRes = await request(app.getHttpServer())
          .get(`/works/${work.id}/pages/pending`)
          .set('Cookie', owner.allCookies)
          .expect(200);

        expect(pendingRes.body).toEqual([]);
      });

      it('should return 403 if not the work owner', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies, {
          allowCollaboration: true,
        });
        const contributor = await registerUser(app, TEST_USER_2);

        const pendingPage = await request(app.getHttpServer())
          .post(`/works/${work.id}/pages`)
          .set('Cookie', contributor.allCookies)
          .send({ content: 'Pending contribution' })
          .expect(201);

        return request(app.getHttpServer())
          .delete(`/pages/${pendingPage.body.id}/reject`)
          .set('Cookie', contributor.allCookies)
          .expect(403);
      });

      it('should return 400 if page is not pending (e.g., already approved)', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies);
        const page = await createPage(work.id, owner.allCookies);

        return request(app.getHttpServer())
          .delete(`/pages/${page.id}/reject`)
          .set('Cookie', owner.allCookies)
          .expect(400);
      });

      it('should return 404 if page does not exist', async () => {
        const owner = await registerUser(app, TEST_USER);
        await createWork(owner.allCookies);

        return request(app.getHttpServer())
          .delete('/pages/00000000-0000-0000-0000-000000000000/reject')
          .set('Cookie', owner.allCookies)
          .expect(404);
      });
    });

    describe('GET /works/:workId/collaborators', () => {
      it('should return empty array when no collaborators exist', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies);

        const res = await request(app.getHttpServer())
          .get(`/works/${work.id}/collaborators`)
          .expect(200);

        expect(res.body).toEqual([]);
      });

      it('should return collaborators with page counts after approving contributions', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies, {
          allowCollaboration: true,
        });
        const contributor = await registerUser(app, TEST_USER_2);

        const pending1 = await request(app.getHttpServer())
          .post(`/works/${work.id}/pages`)
          .set('Cookie', contributor.allCookies)
          .send({ content: 'Contribution 1' })
          .expect(201);

        const pending2 = await request(app.getHttpServer())
          .post(`/works/${work.id}/pages`)
          .set('Cookie', contributor.allCookies)
          .send({ content: 'Contribution 2' })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/pages/${pending1.body.id}/approve`)
          .set('Cookie', owner.allCookies)
          .expect(200);

        await request(app.getHttpServer())
          .post(`/pages/${pending2.body.id}/approve`)
          .set('Cookie', owner.allCookies)
          .expect(200);

        const res = await request(app.getHttpServer())
          .get(`/works/${work.id}/collaborators`)
          .expect(200);

        const collaborators = res.body as {
          userId: string;
          username: string;
          pageCount: number;
        }[];
        const entry = collaborators.find(
          (c) => c.userId === contributor.userId,
        );
        expect(entry).toBeDefined();
        expect(entry?.pageCount).toBe(2);
        expect(entry).toHaveProperty('userId');
        expect(entry).toHaveProperty('username');
        expect(entry).toHaveProperty('pageCount');
      });

      it('should not count pending contributions in collaborators', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies, {
          allowCollaboration: true,
        });
        const contributor = await registerUser(app, TEST_USER_2);

        await request(app.getHttpServer())
          .post(`/works/${work.id}/pages`)
          .set('Cookie', contributor.allCookies)
          .send({ content: 'Pending contribution' })
          .expect(201);

        const res = await request(app.getHttpServer())
          .get(`/works/${work.id}/collaborators`)
          .expect(200);

        expect(res.body).toEqual([]);
      });

      it('should return 404 if work does not exist', () => {
        return request(app.getHttpServer())
          .get('/works/00000000-0000-0000-0000-000000000000/collaborators')
          .expect(404);
      });

      it('should be accessible without authentication', async () => {
        const owner = await registerUser(app, TEST_USER);
        const work = await createWork(owner.allCookies, {
          allowCollaboration: true,
        });
        const contributor = await registerUser(app, TEST_USER_2);

        const pendingPage = await request(app.getHttpServer())
          .post(`/works/${work.id}/pages`)
          .set('Cookie', contributor.allCookies)
          .send({ content: 'Contribution' })
          .expect(201);

        await request(app.getHttpServer())
          .post(`/pages/${pendingPage.body.id}/approve`)
          .set('Cookie', owner.allCookies)
          .expect(200);

        return request(app.getHttpServer())
          .get(`/works/${work.id}/collaborators`)
          .expect(200);
      });
    });
  });
});
