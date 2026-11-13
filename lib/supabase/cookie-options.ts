/**
 * Use a host-only cookie on workers.dev previews. On the production Neweix
 * hostname, AUTH_COOKIE_DOMAIN can opt into the shared .neweix.com scope.
 */
export function getAuthCookieOptions() {
  const production = process.env.NODE_ENV === "production";
  const cookieDomain = production ? process.env.AUTH_COOKIE_DOMAIN : undefined;

  return {
    path: "/",
    sameSite: "lax" as const,
    secure: production,
    ...(production ? { maxAge: 31_536_000 } : {}),
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };
}
