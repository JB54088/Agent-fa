import { mkdir, writeFile } from "node:fs/promises";
import { dataSourcesSeed } from "../db/seeds/data-sources.ts";
import { organizationsSeed } from "../db/seeds/organizations.ts";
import { nationalSourceDirectory } from "../db/seeds/national-source-directory.ts";

const escapeCsv = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const rows = (headers, items) => [headers.join(","), ...items.map((item) => headers.map((header) => escapeCsv(item[header])).join(","))].join("\n") + "\n";

await mkdir("docs/data-sources", { recursive: true });
await writeFile("docs/data-sources/organizations.csv", rows(["organization_name", "organization_type", "industry", "official_website", "recruitment_website", "priority", "status"], organizationsSeed.map((item) => ({ organization_name: item.name, organization_type: item.organizationType, industry: item.industry, official_website: "", recruitment_website: "", priority: item.priority, status: item.status }))));
await writeFile("docs/data-sources/source-audit.csv", rows(["organization_name", "source_url", "source_domain", "official_confirmed", "source_type", "robots_url", "robots_result", "terms_url", "terms_result", "requires_login", "has_captcha", "javascript_required", "recommended_strategy", "recommended_frequency", "automation_allowed", "last_verified_at", "notes"], dataSourcesSeed.map((item) => ({ organization_name: item.organizationName, source_url: item.sourceUrl, source_domain: item.sourceDomain, official_confirmed: item.officialConfirmed, source_type: item.sourceType, robots_url: item.robotsUrl, robots_result: "", terms_url: item.termsUrl, terms_result: "", requires_login: item.requiresLogin, has_captcha: item.hasCaptcha, javascript_required: item.requiresJavascript, recommended_strategy: item.crawlerStrategy, recommended_frequency: item.recommendedFrequency, automation_allowed: item.automationAllowed, last_verified_at: item.lastVerifiedAt, notes: item.notes }))));
await writeFile("docs/data-sources/national-directory.csv", rows(["id", "name", "category", "scope", "region_code", "region_name", "required_official_roles", "source_url", "source_domain", "normal_frequency", "active_frequency", "discovery_status", "last_verified_at", "automation_allowed", "notes"], nationalSourceDirectory.map((item) => ({ id: item.id, name: item.name, category: item.category, scope: item.scope, region_code: item.regionCode, region_name: item.regionName, required_official_roles: item.requiredOfficialRoles.join("、"), source_url: item.sourceUrl, source_domain: item.sourceDomain, normal_frequency: item.normalFrequency, active_frequency: item.activeFrequency, discovery_status: item.discoveryStatus, last_verified_at: item.lastVerifiedAt, automation_allowed: item.automationAllowed, notes: item.notes }))));
