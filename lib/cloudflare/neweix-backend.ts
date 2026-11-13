import { getCloudflareContext } from "@opennextjs/cloudflare";

type WorkerBinding = {
  fetch(request: Request): Promise<Response>;
};

type AccountWorkerEnv = {
  NEWEIX_BACKEND?: WorkerBinding;
  PHONE_OTP_FORWARDING_ENABLED?: string;
  AUTH_COOKIE_DOMAIN?: string;
};

/**
 * Forward only fixed phone-verification routes to the existing Neweix Worker.
 * The browser talks to this Account origin; the service binding keeps the
 * Supabase session cookie server-side and avoids cross-origin cookie sharing.
 */
export async function forwardPhoneApi(
  request: Request,
  backendPath: string,
  options: { mutation?: boolean } = {},
): Promise<Response> {
  const { env: rawEnv } = await getCloudflareContext({ async: true });
  const env = rawEnv as unknown as AccountWorkerEnv;

  if (!env.NEWEIX_BACKEND) {
    return Response.json(
      { error: "The Neweix phone service is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (options.mutation && env.PHONE_OTP_FORWARDING_ENABLED !== "true") {
    return Response.json(
      { error: "Phone OTP actions are disabled on this preview deployment." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if ((origin && origin !== requestUrl.origin) || fetchSite === "cross-site") {
    return Response.json(
      { error: "Cross-origin requests are not allowed." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const target = new URL(requestUrl);
  target.protocol = "https:";
  target.hostname = "neweix.internal";
  target.port = "";
  target.pathname = backendPath;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("origin");
  headers.delete("referer");
  headers.delete("content-length");
  headers.set("Cache-Control", "no-store");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await env.NEWEIX_BACKEND.fetch(new Request(target, init));
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set("Cache-Control", "no-store");

  // The preview worker uses a host-only cookie. The production Neweix Worker
  // may return Domain=.neweix.com while refreshing a session; strip that
  // Domain attribute only when this Account deployment has no cookie domain.
  const cookieHeaders = (upstream.headers as Headers & {
    getSetCookie?: () => string[];
  }).getSetCookie?.() ?? [];
  if (cookieHeaders.length > 0) {
    responseHeaders.delete("set-cookie");
    for (const cookie of cookieHeaders) {
      const adjusted = env.AUTH_COOKIE_DOMAIN
        ? cookie.replace(/;\\s*Domain=[^;]+/i, `; Domain=${env.AUTH_COOKIE_DOMAIN}`)
        : cookie.replace(/;\\s*Domain=[^;]+/i, "");
      responseHeaders.append("set-cookie", adjusted);
    }
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
