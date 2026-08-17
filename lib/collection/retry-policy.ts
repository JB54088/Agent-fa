export type CollectionFailure = "SUCCESS" | "TIMEOUT" | "502" | "EMPTY_BODY" | "TOOL_ERROR" | "SECURITY_POLICY" | "REDIRECT_LOOP" | "JAVASCRIPT_REQUIRED" | "OTHER";
export type RetryDecision = "SUCCESS" | "RETRY_ONCE" | "NEEDS_REVIEW" | "SKIP";

/**
 * Bounded retry policy for public pages. It deliberately never retries
 * security blocks, login/captcha pages, or generic tool errors indefinitely.
 */
export function nextRetryDecision(failure: CollectionFailure, consecutiveFailures: number): RetryDecision {
  if (failure === "SUCCESS") return "SUCCESS";
  if (consecutiveFailures >= 3) return "NEEDS_REVIEW";
  if ((failure === "TIMEOUT" || failure === "502") && consecutiveFailures === 0) return "RETRY_ONCE";
  if (["SECURITY_POLICY", "JAVASCRIPT_REQUIRED", "REDIRECT_LOOP"].includes(failure)) return "NEEDS_REVIEW";
  if (failure === "TOOL_ERROR") return "NEEDS_REVIEW";
  return "SKIP";
}
