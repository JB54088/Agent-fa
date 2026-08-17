import { buildSourcePoolImportPlan } from "../lib/source-pool/import-plan.ts";

const plan = await buildSourcePoolImportPlan(process.cwd());
console.log(JSON.stringify({
  inputSources: plan.records.length,
  inputOrganizations: plan.organizationCount,
  duplicateSourceRecordsInInput: plan.duplicateSourceRecords,
  byCategory: plan.byCategory,
  fields: ["organization_name", "category", "source_type", "official_status", "url", "normalized_url", "source_fingerprint", "first_discovered_at", "last_verified_at", "discovered_from_url"],
}, null, 2));
