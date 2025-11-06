-- Enable row level security on user related tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Template" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Section" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Section" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Favorite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Favorite" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Wallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Wallet" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" FORCE ROW LEVEL SECURITY;

ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" FORCE ROW LEVEL SECURITY;

ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" FORCE ROW LEVEL SECURITY;

-- Shared helper for checking current app user
CREATE POLICY "user_self_select" ON "User"
  FOR SELECT
  USING ("id" = current_setting('app.user_id', true));

CREATE POLICY "user_self_update" ON "User"
  FOR UPDATE
  USING ("id" = current_setting('app.user_id', true))
  WITH CHECK ("id" = current_setting('app.user_id', true));

CREATE POLICY "user_self_delete" ON "User"
  FOR DELETE
  USING ("id" = current_setting('app.user_id', true));

CREATE POLICY "user_service_all" ON "User"
  FOR ALL
  USING (current_setting('app.role', true) = 'service')
  WITH CHECK (current_setting('app.role', true) = 'service');

CREATE POLICY "template_user_select" ON "Template"
  FOR SELECT
  USING ("ownerId" = current_setting('app.user_id', true));

CREATE POLICY "template_user_insert" ON "Template"
  FOR INSERT
  WITH CHECK ("ownerId" = current_setting('app.user_id', true));

CREATE POLICY "template_user_update" ON "Template"
  FOR UPDATE
  USING ("ownerId" = current_setting('app.user_id', true))
  WITH CHECK ("ownerId" = current_setting('app.user_id', true));

CREATE POLICY "template_user_delete" ON "Template"
  FOR DELETE
  USING ("ownerId" = current_setting('app.user_id', true));

CREATE POLICY "template_service_all" ON "Template"
  FOR ALL
  USING (current_setting('app.role', true) = 'service')
  WITH CHECK (current_setting('app.role', true) = 'service');

CREATE POLICY "section_user_select" ON "Section"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "Template" t
      WHERE t."id" = "Section"."templateId"
        AND t."ownerId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY "section_user_insert" ON "Section"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "Template" t
      WHERE t."id" = "Section"."templateId"
        AND t."ownerId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY "section_user_update" ON "Section"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM "Template" t
      WHERE t."id" = "Section"."templateId"
        AND t."ownerId" = current_setting('app.user_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM "Template" t
      WHERE t."id" = "Section"."templateId"
        AND t."ownerId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY "section_user_delete" ON "Section"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM "Template" t
      WHERE t."id" = "Section"."templateId"
        AND t."ownerId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY "section_service_all" ON "Section"
  FOR ALL
  USING (current_setting('app.role', true) = 'service')
  WITH CHECK (current_setting('app.role', true) = 'service');

CREATE POLICY "favorite_user_access" ON "Favorite"
  FOR ALL
  USING (
    "userId" = current_setting('app.user_id', true)
    AND EXISTS (
      SELECT 1
      FROM "Template" t
      WHERE t."id" = "Favorite"."templateId"
        AND t."ownerId" = current_setting('app.user_id', true)
    )
  )
  WITH CHECK (
    "userId" = current_setting('app.user_id', true)
    AND EXISTS (
      SELECT 1
      FROM "Template" t
      WHERE t."id" = "Favorite"."templateId"
        AND t."ownerId" = current_setting('app.user_id', true)
    )
  );

CREATE POLICY "favorite_service_all" ON "Favorite"
  FOR ALL
  USING (current_setting('app.role', true) = 'service')
  WITH CHECK (current_setting('app.role', true) = 'service');

CREATE POLICY "wallet_user_access" ON "Wallet"
  FOR ALL
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

CREATE POLICY "wallet_service_all" ON "Wallet"
  FOR ALL
  USING (current_setting('app.role', true) = 'service')
  WITH CHECK (current_setting('app.role', true) = 'service');

CREATE POLICY "transaction_user_access" ON "Transaction"
  FOR ALL
  USING ("userId" = current_setting('app.user_id', true))
  WITH CHECK ("userId" = current_setting('app.user_id', true));

CREATE POLICY "transaction_service_all" ON "Transaction"
  FOR ALL
  USING (current_setting('app.role', true) = 'service')
  WITH CHECK (current_setting('app.role', true) = 'service');

CREATE POLICY "account_service_all" ON "Account"
  FOR ALL
  USING (current_setting('app.role', true) = 'service')
  WITH CHECK (current_setting('app.role', true) = 'service');

CREATE POLICY "session_service_all" ON "Session"
  FOR ALL
  USING (current_setting('app.role', true) = 'service')
  WITH CHECK (current_setting('app.role', true) = 'service');

CREATE POLICY "verification_token_service_all" ON "VerificationToken"
  FOR ALL
  USING (current_setting('app.role', true) = 'service')
  WITH CHECK (current_setting('app.role', true) = 'service');
