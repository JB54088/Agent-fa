import { NextResponse } from "next/server";

/** Liveness is intentionally process-only and never opens a database request. */
export function GET() {
  return NextResponse.json({ ok: true, service: "school-recruitment-radar", check: "live" });
}
