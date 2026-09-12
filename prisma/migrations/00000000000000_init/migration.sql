-- Initial NowMyWork database schema

CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'FREELANCER', 'ADMIN');
CREATE TYPE "Availability" AS ENUM ('AVAILABLE', 'BUSY', 'AWAY');
CREATE TYPE "ClientPriority" AS ENUM ('QUALITY', 'BALANCED', 'SPEED_BUDGET');
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'MATCHING', 'OFFERED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'SUPERSEDED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firebaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Freelancer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "hourlyRate" INTEGER,
    "experience" INTEGER,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completedJobs" INTEGER NOT NULL DEFAULT 0,
    "availability" "Availability" NOT NULL DEFAULT 'AVAILABLE',
    "skills" TEXT[] NOT NULL,
    "techStack" TEXT[] NOT NULL,
    "portfolioUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Freelancer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "budget" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "durationDays" INTEGER NOT NULL,
    "skills" TEXT[] NOT NULL,
    "techStack" TEXT[] NOT NULL,
    "priority" "ClientPriority" NOT NULL DEFAULT 'BALANCED',
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobOffer" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobOffer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Freelancer_userId_key" ON "Freelancer"("userId");
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");
CREATE INDEX "Job_clientId_idx" ON "Job"("clientId");
CREATE UNIQUE INDEX "JobOffer_jobId_freelancerId_key" ON "JobOffer"("jobId", "freelancerId");
CREATE INDEX "JobOffer_freelancerId_status_idx" ON "JobOffer"("freelancerId", "status");
CREATE INDEX "JobOffer_jobId_status_idx" ON "JobOffer"("jobId", "status");

ALTER TABLE "Freelancer" ADD CONSTRAINT "Freelancer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "Freelancer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
