import type { SourceAuditRecord, SourceDiscoveryStatus, SourceValidationResult } from "../collection/types";

export function evaluateSourceHealth(source: SourceAuditRecord): SourceValidationResult {
  const reasons: string[] = [];
  if (!source.sourceDomain) reasons.push("未登记官方域名");
  if (!source.sourceUrl && !source.listPageUrl && !source.apiUrl && !source.rssUrl) reasons.push("未登记可核验来源地址");
  if (source.requiresLogin === true) reasons.push("来源需要登录");
  if (source.hasCaptcha === true) reasons.push("来源存在验证码或风控验证");
  const status: SourceDiscoveryStatus = reasons.length > 0 ? "NEEDS_REVIEW" : source.discoveryStatus;
  return { valid: reasons.length === 0 && status === "AUTO_ALLOWED", status, reasons, checkedAt: new Date().toISOString() };
}
