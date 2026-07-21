-- Phase B: Agent chat threads
CREATE TABLE IF NOT EXISTS "AgentThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolTrace" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgentThread_userId_idx" ON "AgentThread"("userId");
CREATE INDEX IF NOT EXISTS "AgentThread_userId_updatedAt_idx" ON "AgentThread"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "AgentMessage_threadId_createdAt_idx" ON "AgentMessage"("threadId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgentThread_userId_fkey') THEN
    ALTER TABLE "AgentThread" ADD CONSTRAINT "AgentThread_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgentMessage_threadId_fkey') THEN
    ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_threadId_fkey"
      FOREIGN KEY ("threadId") REFERENCES "AgentThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
