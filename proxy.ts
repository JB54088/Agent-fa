import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "school_radar_session";

/**
 * Fast navigation guard for direct URL visits. The page and API handlers still
 * verify the signed session and database role; this guard prevents a normal
 * anonymous request from rendering a protected route at all.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.get(SESSION_COOKIE_NAME)?.value) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?returnTo=${encodeURIComponent(`${request.nextUrl.pathname}${request.nextUrl.search}`)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/",
    "/jobs/:path*",
    "/opportunities/:path*",
    "/calendar/:path*",
    "/favorites/:path*",
    "/reminders/:path*",
    "/profile/:path*",
    "/job/:path*",
    "/admin/:path*",
  ],
};
