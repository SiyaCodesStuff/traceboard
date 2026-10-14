-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('DRAFT', 'APPROVED', 'TESTED');

-- CreateEnum
CREATE TYPE "TestCaseStatus" AS ENUM ('NOT_RUN', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('REQUIREMENT', 'USER_STORY', 'TEST_CASE');

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_id" UUID NOT NULL,
    "req_seq" INTEGER NOT NULL DEFAULT 0,
    "story_seq" INTEGER NOT NULL DEFAULT 0,
    "test_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "project_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "Priority" NOT NULL,
    "status" "RequirementStatus" NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStory" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "project_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "as_a" TEXT NOT NULL,
    "i_want" TEXT NOT NULL,
    "so_that" TEXT NOT NULL,

    CONSTRAINT "UserStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "project_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "expected_result" TEXT NOT NULL,
    "status" "TestCaseStatus" NOT NULL,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Link" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "project_id" UUID NOT NULL,
    "source_type" "EntityType" NOT NULL,
    "source_id" UUID NOT NULL,
    "target_type" "EntityType" NOT NULL,
    "target_id" UUID NOT NULL,

    CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Requirement_project_id_idx" ON "Requirement"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "Requirement_project_id_code_key" ON "Requirement"("project_id", "code");

-- CreateIndex
CREATE INDEX "UserStory_project_id_idx" ON "UserStory"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserStory_project_id_code_key" ON "UserStory"("project_id", "code");

-- CreateIndex
CREATE INDEX "TestCase_project_id_idx" ON "TestCase"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "TestCase_project_id_code_key" ON "TestCase"("project_id", "code");

-- CreateIndex
CREATE INDEX "Link_project_id_idx" ON "Link"("project_id");

-- CreateIndex
CREATE INDEX "Link_source_type_source_id_idx" ON "Link"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "Link_target_type_target_id_idx" ON "Link"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "Link_source_type_source_id_target_type_target_id_key" ON "Link"("source_type", "source_id", "target_type", "target_id");

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStory" ADD CONSTRAINT "UserStory_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
