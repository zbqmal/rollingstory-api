import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Deletes all records in the correct FK-safe order.
 * Use in beforeEach of e2e tests instead of duplicating deleteMany calls.
 */
export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  await prisma.like.deleteMany();
  await prisma.workCollaborator.deleteMany();
  await prisma.page.deleteMany();
  await prisma.work.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}
