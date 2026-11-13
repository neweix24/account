import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthCookieOptions } from "@/lib/supabase/cookie-options";

function isProtectedPath(pathname: string) {
  return pathname === "/account" || pathname.startsWith("/account/") ||
    pathname === "/mfa" || pathname.startsWith("/mfa/");
}

function redirectToLogin(request: NextRequest) {
  const redirect = NextResponse.redirect(new URL("/login?error=Your%20session%20is%20no%20longer%20active.%20Please%20sign%20in%20again.", request.url));
  request.cookies.getAll().forEach(({ name }) => {
    if (name.startsWith("sb-")) redirect.cookies.delete(name);
  });
  redirect.headers.set("Cache-Control", "no-store");
  return redirect;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookieOptions: getAuthCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Keep the standard SSR refresh flow intact before checking the live session row.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!isProtectedPath(request.nextUrl.pathname)) return response;
  if (claimsError || !claims || typeof claims.session_id !== "string") {
    return redirectToLogin(request);
  }

  // JWTs are stateless: a deleted Auth session does not invalidate an already-issued
  // access token by itself. Check session_id against auth.sessions on protected requests.
  const { data: sessionIsValid, error: validationError } = await supabase.rpc(
    "neweix_validate_current_session",
  );

  if (validationError) {
    // Fail closed, but preserve refreshed auth cookies so a transient DB error does not
    // destroy the user's session or silently sign them out.
    const unavailable = new NextResponse(
      "Neweix Account security verification is temporarily unavailable. Please try again.",
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
    );
    response.cookies.getAll().forEach((cookie) => unavailable.cookies.set(cookie));
    return unavailable;
  }

  if (sessionIsValid !== true) return redirectToLogin(request);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
