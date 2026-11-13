import * as Sentry from "npm:@sentry/deno@11.9.0";
const SENTRY_DSN = Deno.env.get("SENTRY_DSN") ?? "https://4a80e5b20d5f93801845e87071a1e612@o4512412827058176.ingest.us.sentry.io/4512412888530944";
Sentry.init({ dsn: SENTRY_DSN, defaultIntegrations: false, tracesSampleRate: 0, environment: Deno.env.get("SENTRY_ENVIRONMENT") ?? "production" });
async function reportSentryError(error: unknown, functionName: string, requestId?: string | null): Promise<void> { Sentry.withScope((scope) => { scope.setTag("service", "neweix-account"); scope.setTag("supabase_function", functionName); const region = Deno.env.get("SB_REGION"); const executionId = Deno.env.get("SB_EXECUTION_ID"); if (region) scope.setTag("region", region); if (executionId) scope.setExtra("execution_id", executionId); if (requestId) scope.setTag("request_id", requestId); Sentry.captureException(error); }); await Sentry.flush(2000); }
function withSentry(functionName: string, handler: (request: Request) => Response | Promise<Response>): (request: Request) => Promise<Response> { return async (request: Request): Promise<Response> => { try { const result = await handler(request); if (result.status >= 500) await reportSentryError(new Error(`${functionName} returned HTTP ${result.status}`), functionName, result.headers.get("x-request-id")); return result; } catch (error) { await reportSentryError(error, functionName, request.headers.get("x-request-id")); return new Response(JSON.stringify({ error: { code: "INTERNAL_ERROR" } }), { status: 500, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); } }; }

import { isEmailIdentifier } from "./validation.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://neweix.com",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-neweix-client-ip-proof",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function recordLoginEvent(
  admin: any,
  input: {
    userId: string | null;
    eventType: "login_success" | "login_failure";
    ipHash: string | null;
    userAgent: string | null;
    metadata: Record<string, string>;
  },
) {
  const { error } = await admin.rpc("neweix_record_login_security_event", {
    p_user_id: input.userId,
    p_event_type: input.eventType,
    p_ip_hash: input.ipHash,
    p_user_agent: input.userAgent,
    p_metadata: input.metadata,
  });
  if (error) console.error("Account login audit event could not be recorded:", error.message);
}

async function verifyClientIpProof(ip: string, proof: string, secret: string) {
  if (!ip || !/^[a-f0-9]{64}$/i.test(proof)) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signature = new Uint8Array(proof.match(/.{2}/g)!.map((byte) => Number.parseInt(byte, 16)));
    return await crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(ip));
  } catch {
    return false;
  }
}

Deno.serve(withSentry("neweix-username-login", async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Sign-in failed." });

  const origin = request.headers.get("origin");
  if (origin && origin !== "https://neweix.com" && origin !== "http://localhost:3000") {
    return json(403, { error: "Sign-in failed." });
  }

  try {
    const payload = await request.json();
    const identifier = String(payload?.identifier ?? "").trim().toLowerCase();
    const password = String(payload?.password ?? "");
    const clientIp = String(payload?.clientIp ?? "").trim();
    const clientIpProof = request.headers.get("x-neweix-client-ip-proof") ?? "";

    if (!identifier || identifier.length > 254 || !password || password.length > 1024) {
      return json(400, { error: "Sign-in failed. Check your credentials and verification." });
    }

    const projectUrl = Deno.env.get("SUPABASE_URL");
    const secretMapRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
    const publishableMapRaw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
    const legacySecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const legacyPublishable = Deno.env.get("SUPABASE_ANON_KEY");
    if (!projectUrl || (!secretMapRaw && !legacySecret) || (!publishableMapRaw && !legacyPublishable)) {
      return json(503, { error: "Sign-in is temporarily unavailable." });
    }

    const secretKey = secretMapRaw ? JSON.parse(secretMapRaw).default : legacySecret;
    const publishableKey = publishableMapRaw ? JSON.parse(publishableMapRaw).default : legacyPublishable;
    const admin = createClient(projectUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const identifierHash = await sha256(identifier);
    const ipHashSecret = Deno.env.get("LOGIN_RATE_LIMIT_HMAC_SECRET");
    const trustedIp = Boolean(ipHashSecret && await verifyClientIpProof(clientIp, clientIpProof, ipHashSecret));
    const ipHash = trustedIp ? await sha256(`${ipHashSecret}:${clientIp}`) : null;
    const rateLimitIpHash = ipHash ?? identifierHash;
    const userAgent = request.headers.get("user-agent");

    const { data: allowed, error: rateError } = await admin.rpc("neweix_consume_login_rate_limit", {
      p_identifier_hash: identifierHash,
      p_ip_hash: rateLimitIpHash,
    });
    if (rateError || allowed !== true) {
      await recordLoginEvent(admin, {
        userId: null,
        eventType: "login_failure",
        ipHash,
        userAgent,
        metadata: { reason: "rate_limited" },
      });
      return json(429, { error: "Too many sign-in attempts. Try again in 15 minutes." });
    }

    const isEmail = isEmailIdentifier(identifier);
    const findAccount = async (table: "account" | "neweix_accounts") => {
      const query = admin.from(table).select("user_id,email,account_status");
      return isEmail
        ? await query.ilike("email", identifier).maybeSingle()
        : await query.eq("username", identifier).maybeSingle();
    };

    // Keep login available while the canonical table is renamed during rollout.
    let { data: account, error: lookupError } = await findAccount("account");
    if (lookupError?.code === "PGRST205" || lookupError?.code === "42P01") {
      const legacyResult = await findAccount("neweix_accounts");
      account = legacyResult.data;
      lookupError = legacyResult.error;
    }

    if (lookupError || !account?.email || account.account_status !== "active") {
      await recordLoginEvent(admin, {
        userId: account?.user_id ?? null,
        eventType: "login_failure",
        ipHash,
        userAgent,
        metadata: { reason: "account_lookup_or_status" },
      });
      return json(401, { error: "Sign-in failed. Check your credentials and verification." });
    }

    const authResponse = await fetch(`${projectUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: publishableKey },
      body: JSON.stringify({ email: account.email, password }),
    });
    if (!authResponse.ok) {
      await recordLoginEvent(admin, {
        userId: account.user_id,
        eventType: "login_failure",
        ipHash,
        userAgent,
        metadata: { reason: "invalid_credentials" },
      });
      return json(401, { error: "Sign-in failed. Check your credentials and verification." });
    }

    const session = await authResponse.json();
    if (!session?.access_token || !session?.refresh_token || session?.user?.id !== account.user_id) {
      await recordLoginEvent(admin, {
        userId: account.user_id,
        eventType: "login_failure",
        ipHash,
        userAgent,
        metadata: { reason: "invalid_auth_session_response" },
      });
      return json(401, { error: "Sign-in failed. Check your credentials and verification." });
    }

    await recordLoginEvent(admin, {
      userId: account.user_id,
      eventType: "login_success",
      ipHash,
      userAgent,
      metadata: { method: "password", identifier_type: isEmail ? "email" : "username" },
    });

    return json(200, {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      token_type: session.token_type,
    });
  } catch (error) {
    if (!(error instanceof SyntaxError)) await reportSentryError(error, "neweix-username-login");
    return json(400, { error: "Sign-in failed. Check your credentials and verification." });
  }
}));
