/**
 * Keep the Account application's Supabase auth cookie scope identical to the
 * existing Neweix Worker so sibling Neweix subdomains can use the same session.
 * Local development stays host-only and does not set Secure on localhost.
 */
export function getAuthCookieOptions() {
  const production = process.env.NODE_ENV === "production";

  return {
    path: "/",
    sameSite: "lax" as const,
    secure: production,
    ...(production
      ? {
          domain: ".neweix.com",
          maxAge: 31_536_000,
        }
      : {}),
  };
}
