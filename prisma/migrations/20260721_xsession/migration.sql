-- Phase A: XSession encrypted store + Operation.sessionId
-- CreateTable
CREATE TABLE IF NOT EXISTS "XSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'primary',
    "username" TEXT,
    "cookieEnc" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XSession_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Operation" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XSession_userId_idx" ON "XSession"("userId");
CREATE INDEX IF NOT EXISTS "XSession_userId_status_idx" ON "XSession"("userId", "status");
CREATE INDEX IF NOT EXISTS "XSession_username_idx" ON "XSession"("username");
CREATE INDEX IF NOT EXISTS "Operation_sessionId_idx" ON "Operation"("sessionId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'XSession_userId_fkey'
  ) THEN
    ALTER TABLE "XSession" ADD CONSTRAINT "XSession_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Operation_sessionId_fkey'
  ) THEN
    ALTER TABLE "Operation" ADD CONSTRAINT "Operation_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "XSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
