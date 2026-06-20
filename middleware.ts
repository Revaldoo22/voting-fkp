import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const ROLE_PREFIX: Record<string, string> = {
  "/admin": "admin",
  "/participant": "participant",
};

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const path = request.nextUrl.pathname;

  const matched = Object.keys(ROLE_PREFIX).find((p) => path.startsWith(p));
  if (!matched) return response;

  // Carry the refreshed auth cookies onto any redirect we return, otherwise
  // the rotated session token is lost and the next request logs the user out.
  const redirectTo = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    if (pathname === "/login") url.searchParams.set("next", path);
    else url.search = "";
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  // Must be logged in.
  if (!user) return redirectTo("/login");

  // Must hold the right role.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const required = ROLE_PREFIX[matched];
  if (profile?.role !== required) {
    return redirectTo(
      profile?.role === "admin"
        ? "/admin"
        : profile?.role === "participant"
        ? "/participant/dashboard"
        : "/"
    );
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/participant/:path*"],
};
