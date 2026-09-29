type Window = { startedAt: number; count: number };

const IP_WINDOW_MS = 60_000;
const IP_MAX_ATTEMPTS = 10;
const PHONE_FAILURE_WINDOW_MS = 5 * 60_000;
const PHONE_MAX_FAILURES = 8;

const ipAttempts = new Map<string, Window>();
const phoneFailures = new Map<string, Window>();

function take(map: Map<string, Window>, key: string, windowMs: number, max: number) {
  const now = Date.now();
  const current = map.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    map.set(key, { startedAt: now, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= max) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1000)) };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function checkLoginRateLimit(request: Request, phone: string) {
  const ipResult = take(ipAttempts, clientIp(request), IP_WINDOW_MS, IP_MAX_ATTEMPTS);
  if (!ipResult.allowed) return { allowed: false, retryAfterSeconds: ipResult.retryAfterSeconds, reason: "ip" as const };
  if (phone) {
    const failure = phoneFailures.get(phone);
    if (failure && Date.now() - failure.startedAt < PHONE_FAILURE_WINDOW_MS && failure.count >= PHONE_MAX_FAILURES) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((PHONE_FAILURE_WINDOW_MS - (Date.now() - failure.startedAt)) / 1000)), reason: "phone" as const };
    }
  }
  return { allowed: true, retryAfterSeconds: 0, reason: null };
}

export function recordLoginFailure(phone: string) {
  if (phone) take(phoneFailures, phone, PHONE_FAILURE_WINDOW_MS, PHONE_MAX_FAILURES);
}

export function clearLoginFailures(phone: string) {
  if (phone) phoneFailures.delete(phone);
}
