-- DropForeignKey
ALTER TABLE "Page" DROP CONSTRAINT "Page_authorId_fkey";

-- DropIndex
DROP INDEX "Page_workId_pageNumber_idx";

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending',
ALTER COLUMN "pageNumber" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Page_workId_status_idx" ON "Page"("workId", "status");

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
