import type { SourceAuditRecord } from "./types";

export type SafeHttpPolicy = {
  timeoutMs: number;
  maxRetries: number;
  maxRedirects: number;
  maxResponseBytes: number;
  defaultRequestIntervalSeconds: number;
  retryBackoffMs: number;
};

export type SafeFetchResult = {
  url: string;
  status: number;
  contentType: string | null;
  body: ArrayBuffer;
  headers: Headers;
};

export class SourceRequestError extends Error {
  readonly code: "INVALID_URL" | "SSRF_BLOCKED" | "HTTP_403" | "HTTP_429" | "RESPONSE_TOO_LARGE" | "CONTENT_TYPE_REJECTED" | "TIMEOUT" | "NETWORK_ERROR" | "REDIRECT_BLOCKED";
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    message: string,
    code: "INVALID_URL" | "SSRF_BLOCKED" | "HTTP_403" | "HTTP_429" | "RESPONSE_TOO_LARGE" | "CONTENT_TYPE_REJECTED" | "TIMEOUT" | "NETWORK_ERROR" | "REDIRECT_BLOCKED",
    status?: number,
    retryable = false,
  ) {
    super(message);
    this.name = "SourceRequestError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

const defaultPolicy: SafeHttpPolicy = {
  timeoutMs: 15_000,
  maxRetries: 1,
  maxRedirects: 2,
  maxResponseBytes: 2_000_000,
  defaultRequestIntervalSeconds: 10,
  retryBackoffMs: 1_000,
};

const privateIpv4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

export function isPrivateIp(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return privateIpv4.test(host) || host === "localhost" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
}

export function isAllowedSourceHostname(hostname: string, sourceDomain: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const domain = sourceDomain.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  return host === domain || host.endsWith(`.${domain}`);
}

export function validateSourceUrl(rawUrl: string, sourceDomain: string | null) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SourceRequestError("URL格式不正确", "INVALID_URL");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new SourceRequestError("只允许不带认证信息的HTTPS来源", "INVALID_URL");
  }
  if (isPrivateIp(parsed.hostname)) {
    throw new SourceRequestError("来源地址指向私有网络或本机地址", "SSRF_BLOCKED");
  }
  if (!sourceDomain || !isAllowedSourceHostname(parsed.hostname, sourceDomain)) {
    throw new SourceRequestError("来源域名不在已登记的官方域名范围内", "SSRF_BLOCKED");
  }
  return parsed;
}

class HostRateLimiter {
  private readonly nextAllowedAt = new Map<string, number>();

  async wait(host: string, intervalMs: number) {
    const now = Date.now();
    const next = this.nextAllowedAt.get(host) ?? now;
    const waitMs = Math.max(0, next - now);
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.nextAllowedAt.set(host, Date.now() + intervalMs);
  }
}

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

export class SafeSourceHttpClient {
  private readonly policy: SafeHttpPolicy;
  private readonly limiter = new HostRateLimiter();
  private readonly fetchImpl: FetchImpl;

  constructor(options: { policy?: Partial<SafeHttpPolicy>; fetchImpl?: FetchImpl } = {}) {
    this.policy = { ...defaultPolicy, ...options.policy };
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  async get(source: SourceAuditRecord, rawUrl: string, context: { signal?: AbortSignal; userAgent?: string } = {}): Promise<SafeFetchResult> {
    const incrementalPublicApproval = source.incrementalSyncEnabled === true
      && source.discoveryStatus === "VERIFIED"
      && source.requiresLogin !== true
      && source.hasCaptcha !== true;
    if (source.discoveryStatus !== "AUTO_ALLOWED" && source.discoveryStatus !== "ATTACHMENT_ONLY" && !incrementalPublicApproval) {
      throw new SourceRequestError("该来源尚未获准自动采集", "SSRF_BLOCKED");
    }
    let target = validateSourceUrl(rawUrl, source.sourceDomain);
    let redirectCount = 0;
    let attempt = 0;

    while (true) {
      await this.limiter.wait(target.hostname, Math.max(0, source.requestIntervalSeconds || this.policy.defaultRequestIntervalSeconds) * 1_000);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.policy.timeoutMs);
      const signal = context.signal ? AbortSignal.any([context.signal, controller.signal]) : controller.signal;
      try {
        const response = await this.fetchImpl(target.toString(), {
          method: "GET",
          redirect: "manual",
          signal,
          headers: { accept: "text/html,application/xhtml+xml,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "user-agent": context.userAgent ?? source.userAgent ?? "SchoolRecruitmentRadar/1.0 (+public-source-audit)" },
        });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          if (redirectCount >= this.policy.maxRedirects) throw new SourceRequestError("超过允许的重定向次数", "REDIRECT_BLOCKED", response.status);
          const location = response.headers.get("location");
          if (!location) throw new SourceRequestError("重定向缺少目标地址", "REDIRECT_BLOCKED", response.status);
          const next = validateSourceUrl(new URL(location, target).toString(), source.sourceDomain);
          if (next.origin !== target.origin) throw new SourceRequestError("禁止跨域重定向", "REDIRECT_BLOCKED", response.status);
          target = next;
          redirectCount += 1;
          continue;
        }
        if (response.status === 403) throw new SourceRequestError("来源返回403，已停止本次任务", "HTTP_403", 403);
        if (response.status === 429) throw new SourceRequestError("来源返回429，已停止本次任务并延长下次检查", "HTTP_429", 429);
        if (!response.ok) {
          if (attempt < this.policy.maxRetries && response.status >= 500) {
            attempt += 1;
            await new Promise((resolve) => setTimeout(resolve, this.policy.retryBackoffMs * attempt));
            continue;
          }
          throw new SourceRequestError(`来源返回HTTP ${response.status}`, "NETWORK_ERROR", response.status, response.status >= 500);
        }
        const declaredLength = Number(response.headers.get("content-length") ?? 0);
        if (declaredLength > this.policy.maxResponseBytes) throw new SourceRequestError("响应体超过大小限制", "RESPONSE_TOO_LARGE", response.status);
        const body = await response.arrayBuffer();
        if (body.byteLength > this.policy.maxResponseBytes) throw new SourceRequestError("响应体超过大小限制", "RESPONSE_TOO_LARGE", response.status);
        return { url: target.toString(), status: response.status, contentType: response.headers.get("content-type"), body, headers: response.headers };
      } catch (error) {
        if (error instanceof SourceRequestError) throw error;
        if (context.signal?.aborted) throw new SourceRequestError("采集任务已取消", "TIMEOUT");
        if (error instanceof DOMException && error.name === "AbortError") throw new SourceRequestError("来源请求超时", "TIMEOUT", undefined, true);
        if (attempt < this.policy.maxRetries) {
          attempt += 1;
          await new Promise((resolve) => setTimeout(resolve, this.policy.retryBackoffMs * attempt));
          continue;
        }
        throw new SourceRequestError("来源网络请求失败", "NETWORK_ERROR", undefined, true);
      } finally {
        clearTimeout(timeout);
      }
    }
  }
}
