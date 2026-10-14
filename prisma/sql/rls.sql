-- Run after the Prisma migration has created these tables.
BEGIN;

ALTER TABLE public."Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Requirement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UserStory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TestCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Link" ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public."Project", public."Requirement", public."UserStory",
  public."TestCase", public."Link"
TO authenticated;

-- FOR ALL covers SELECT, INSERT, UPDATE, and DELETE. WITH CHECK protects new rows.
DROP POLICY IF EXISTS project_owner_access ON public."Project";
CREATE POLICY project_owner_access ON public."Project"
  FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS requirement_owner_access ON public."Requirement";
CREATE POLICY requirement_owner_access ON public."Requirement"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."Project" AS p
    WHERE p.id = "Requirement".project_id AND p.owner_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."Project" AS p
    WHERE p.id = "Requirement".project_id AND p.owner_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS user_story_owner_access ON public."UserStory";
CREATE POLICY user_story_owner_access ON public."UserStory"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."Project" AS p
    WHERE p.id = "UserStory".project_id AND p.owner_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."Project" AS p
    WHERE p.id = "UserStory".project_id AND p.owner_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS test_case_owner_access ON public."TestCase";
CREATE POLICY test_case_owner_access ON public."TestCase"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."Project" AS p
    WHERE p.id = "TestCase".project_id AND p.owner_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."Project" AS p
    WHERE p.id = "TestCase".project_id AND p.owner_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS link_owner_access ON public."Link";
CREATE POLICY link_owner_access ON public."Link"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public."Project" AS p
    WHERE p.id = "Link".project_id AND p.owner_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."Project" AS p
    WHERE p.id = "Link".project_id AND p.owner_id = (SELECT auth.uid())
  ));

COMMIT;
