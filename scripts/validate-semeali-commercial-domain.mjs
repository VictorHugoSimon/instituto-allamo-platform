import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireIncludes(content, expected, context) {
  if (!content.includes(expected)) {
    throw new Error(`${context}: expected ${JSON.stringify(expected)}`);
  }
}

const commercialMigration = read(
  "supabase/migrations/20260903132000_create_commercial_domain.sql",
);
const hardeningMigration = read(
  "supabase/migrations/20260903132500_harden_commercial_tenant_relations.sql",
);
const metadataMigration = read(
  "supabase/migrations/20260903121500_add_organization_white_label_metadata.sql",
);
const commercialPage = read(
  "apps/web/src/app/(protected)/dashboard/comercial/page.tsx",
);
const liveWorkspace = read(
  "apps/web/src/components/commercial/semeali-live-workspace.tsx",
);

for (const table of [
  "commercial_accounts",
  "commercial_opportunities",
  "commercial_interactions",
  "commercial_routes",
  "commercial_route_stops",
  "commercial_campaigns",
  "commercial_approvals",
]) {
  requireIncludes(
    commercialMigration,
    `create table public.${table}`,
    `missing commercial table ${table}`,
  );
  requireIncludes(
    commercialMigration,
    `alter table public.${table} enable row level security`,
    `RLS not enabled for ${table}`,
  );
}

for (const permission of [
  "commercial.read",
  "commercial.manage",
  "commercial.field",
  "commercial.approve",
]) {
  requireIncludes(
    commercialMigration,
    permission,
    `missing permission ${permission}`,
  );
}

for (const relation of [
  "commercial_opportunities_account_same_org_fk",
  "commercial_interactions_account_same_org_fk",
  "commercial_interactions_opportunity_same_org_fk",
  "commercial_route_stops_route_same_org_fk",
  "commercial_route_stops_account_same_org_fk",
  "commercial_approvals_opportunity_same_org_fk",
  "commercial_approvals_account_same_org_fk",
]) {
  requireIncludes(
    hardeningMigration,
    relation,
    `missing same-tenant relation ${relation}`,
  );
}

requireIncludes(
  metadataMigration,
  "add column if not exists metadata jsonb",
  "white-label metadata migration missing",
);

requireIncludes(
  commercialPage,
  'supabase.rpc("commercial_workspace_summary"',
  "commercial page is not reading live summary",
);
requireIncludes(
  commercialPage,
  'supabase.rpc("list_commercial_opportunities"',
  "commercial page is not reading live opportunities",
);
requireIncludes(
  commercialPage,
  "hasLiveCommercialData(summary, opportunities)",
  "commercial live/demo fallback missing",
);
requireIncludes(
  commercialPage,
  "<SemealiLiveWorkspace",
  "live commercial workspace is not wired",
);
requireIncludes(
  liveWorkspace,
  "Dados reais do tenant",
  "live workspace must identify real tenant data",
);

console.log("Semeali commercial domain validation passed.");
