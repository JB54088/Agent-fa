import { SafeSourceHttpClient, SourceRequestError } from "../collection/http-client.ts";
import { chooseAdapter } from "../collection/adapters.ts";
import type { FetchContext, SourceAuditRecord, SourceRunStatus } from "../collection/types.ts";

export type SourceFetchRunResult = {
  status: SourceRunStatus;
  requestCount: number;
  discoveredCount: number;
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
};

export async function runSourceFetch(source: SourceAuditRecord, options: { dryRun?: boolean; client?: SafeSourceHttpClient } = {}): Promise<SourceFetchRunResult> {
  if (source.discoveryStatus === "BLOCKED" || source.discoveryStatus === "MANUAL_ONLY" || source.discoveryStatus === "NEEDS_REVIEW" || !source.automationAllowed) {
    return { status: "SKIPPED", requestCount: 0, discoveredCount: 0, createdCount: 0, skippedCount: 1, errorCount: 0, errors: ["来源未获准自动采集，已跳过"] };
  }
  if (!source.listPageUrl || !source.sourceDomain) {
    return { status: "SKIPPED", requestCount: 0, discoveredCount: 0, createdCount: 0, skippedCount: 1, errorCount: 0, errors: ["来源缺少已核验的列表页或官方域名"] };
  }
  const context: FetchContext = { source, dryRun: options.dryRun };
  const adapter = chooseAdapter(source.crawlerStrategy, null);
  const client = options.client ?? new SafeSourceHttpClient();
  try {
    const response = await client.get(source, source.listPageUrl);
    const html = new TextDecoder().decode(response.body);
    const items = source.crawlerStrategy === "HTML_LIST" ? await adapter.fetchList({ ...context, html, source: { ...source, listPageUrl: source.listPageUrl } }) : [];
    return { status: "SUCCESS", requestCount: 1, discoveredCount: items.length || (html.length > 0 ? 1 : 0), createdCount: options.dryRun ? 0 : 0, skippedCount: 0, errorCount: 0, errors: [] };
  } catch (error) {
    const message = error instanceof SourceRequestError ? `${error.code}: ${error.message}` : "来源采集失败";
    const blocked = error instanceof SourceRequestError && ["HTTP_403", "HTTP_429", "SSRF_BLOCKED", "REDIRECT_BLOCKED"].includes(error.code);
    return { status: blocked ? "BLOCKED" : "FAILED", requestCount: 1, discoveredCount: 0, createdCount: 0, skippedCount: 0, errorCount: 1, errors: [message] };
  }
}
