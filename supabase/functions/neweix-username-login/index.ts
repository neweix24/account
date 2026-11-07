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

Deno.serve(async (request: Request) => {
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
    const trustedIp = ipHashSecret && await verifyClientIpProof(clientIp, clientIpProof, ipHashSecret);
    const ipHash = trustedIp ? await sha256(`${ipHashSecret}:${clientIp}`) : identifierHash;

    const { data: allowed, error: rateError } = await admin.rpc("neweix_consume_login_rate_limit", {
      p_identifier_hash: identifierHash,
      p_ip_hash: ipHash,
    });
    if (rateError || allowed !== true) {
      return json(429, { error: "Too many sign-in attempts. Try again in 15 minutes." });
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const accountQuery = admin.from("account").select("user_id,email,account_status");
    const { data: account, error: lookupError } = isEmail
      ? await accountQuery.ilike("email", identifier).maybeSingle()
      : await accountQuery.eq("username", identifier).maybeSingle();

    if (lookupError || !account?.email || account.account_status !== "active") {
      return json(401, { error: "Sign-in failed. Check your credentials and verification." });
    }

    const authResponse = await fetch(`${projectUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: publishableKey },
      body: JSON.stringify({ email: account.email, password }),
    });
    if (!authResponse.ok) {
      return json(401, { error: "Sign-in failed. Check your credentials and verification." });
    }

    const session = await authResponse.json();
    if (!session?.access_token || !session?.refresh_token || session?.user?.id !== account.user_id) {
      return json(401, { error: "Sign-in failed. Check your credentials and verification." });
    }
    return json(200, {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      token_type: session.token_type,
    });
  } catch {
    return json(400, { error: "Sign-in failed. Check your credentials and verification." });
  }
});
