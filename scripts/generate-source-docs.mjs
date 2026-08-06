import { mkdir, writeFile } from "node:fs/promises";
import { dataSourcesSeed } from "../db/seeds/data-sources.ts";
import { organizationsSeed } from "../db/seeds/organizations.ts";

const escapeCsv = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const rows = (headers, items) => [headers.join(","), ...items.map((item) => headers.map((header) => escapeCsv(item[header])).join(","))].join("\n") + "\n";

await mkdir("docs/data-sources", { recursive: true });
await writeFile("docs/data-sources/organizations.csv", rows(["organization_name", "organization_type", "industry", "official_website", "recruitment_website", "priority", "status"], organizationsSeed.map((item) => ({ organization_name: item.name, organization_type: item.organizationType, industry: item.industry, official_website: "", recruitment_website: "", priority: item.priority, status: item.status }))));
await writeFile("docs/data-sources/source-audit.csv", rows(["organization_name", "source_url", "source_domain", "official_confirmed", "source_type", "robots_url", "robots_result", "terms_url", "terms_result", "requires_login", "has_captcha", "javascript_required", "recommended_strategy", "recommended_frequency", "automation_allowed", "last_verified_at", "notes"], dataSourcesSeed.map((item) => ({ organization_name: item.organizationName, source_url: item.sourceUrl, source_domain: item.sourceDomain, official_confirmed: item.officialConfirmed, source_type: item.sourceType, robots_url: item.robotsUrl, robots_result: "", terms_url: item.termsUrl, terms_result: "", requires_login: item.requiresLogin, has_captcha: item.hasCaptcha, javascript_required: item.requiresJavascript, recommended_strategy: item.crawlerStrategy, recommended_frequency: item.recommendedFrequency, automation_allowed: item.automationAllowed, last_verified_at: item.lastVerifiedAt, notes: item.notes }))));
