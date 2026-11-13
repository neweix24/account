"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function getSiteOrigin(): Promise<string | null> {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();

  if (host === "www.accounts.neweix.com") return "https://www.accounts.neweix.com";
  if (host === "localhost:3000") return "http://localhost:3000";
  if (/^[a-z0-9.-]+\\.workers\\.dev$/.test(host)) return `https://${host}`;

  return process.env.NEXT_PUBLIC_SITE_URL ?? null;
}

export async function signUp(formData: FormData) {
  const fullName = value(formData, "fullName");
  const username = value(formData, "username").toLowerCase();
  const email = value(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!fullName || !/^[a-z0-9_]{3,20}$/.test(username) || !email || password.length < 12 || password !== confirmPassword) {
    redirect("/signup?error=Check%20your%20details.%20Username%20must%20be%203%E2%80%9320%20characters%20and%20passwords%20must%20match.");
  }

  const siteUrl = await getSiteOrigin();
  if (!siteUrl) redirect("/signup?error=Sign-up%20is%20temporarily%20unavailable.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm`,
      data: { full_name: fullName, username, identity_type: "customer" },
    },
  });

  if (error) redirect("/signup?error=Unable%20to%20create%20account.%20Check%20your%20details%20or%20try%20again.");
  redirect("/signup?message=Check%20your%20email%20to%20verify%20your%20Neweix%20Account.");
}

export async function signIn(formData: FormData) {
  const identifier = value(formData, "identifier").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) redirect("/login?error=Enter%20your%20username%20or%20email%20and%20password.");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) redirect("/login?error=Sign-in%20is%20temporarily%20unavailable.");

  const supabase = await createClient();
  const requestHeaders = await headers();
  const rateLimitSecret = process.env.LOGIN_RATE_LIMIT_HMAC_SECRET;
  const clientIp = requestHeaders.get("cf-connecting-ip")?.trim()
    || requestHeaders.get("x-real-ip")?.trim()
    || requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "";

  const requestBody: { identifier: string; password: string; clientIp?: string } = { identifier, password };
  const requestHeadersForFunction: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: publishableKey,
  };

  if (rateLimitSecret && clientIp) {
    requestBody.clientIp = clientIp;
    requestHeadersForFunction["x-neweix-client-ip-proof"] = createHmac("sha256", rateLimitSecret)
      .update(clientIp)
      .digest("hex");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/neweix-username-login`, {
    method: "POST",
    headers: requestHeadersForFunction,
    body: JSON.stringify(requestBody),
    cache: "no-store",
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token || !result.refresh_token) {
    redirect(`/login?error=${encodeURIComponent(result.error ?? "Sign-in failed. Check your credentials and verification.")}`);
  }

  const { error } = await supabase.auth.setSession({
    access_token: result.access_token,
    refresh_token: result.refresh_token,
  });
  if (error) redirect("/login?error=Sign-in%20failed.%20Please%20try%20again.");
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel === "aal1" && assurance?.nextLevel === "aal2") redirect("/mfa");
  redirect("/account");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
  const email = value(formData, "email").toLowerCase();
  if (!email) redirect("/reset-password?message=If%20the%20account%20exists,%20a%20recovery%20email%20will%20be%20sent.");

  const siteUrl = await getSiteOrigin();
  if (!siteUrl) redirect("/reset-password?message=If%20the%20account%20exists,%20a%20recovery%20email%20will%20be%20sent.");

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/update-password`,
  });
  redirect("/reset-password?message=If%20the%20account%20exists,%20a%20recovery%20email%20will%20be%20sent.");
}


export async function updateRecoveredPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 12 || password.length > 128) {
    redirect("/update-password?error=Use%20a%20password%20between%2012%20and%20128%20characters.");
  }
  if (password !== confirmPassword) {
    redirect("/update-password?error=The%20passwords%20do%20not%20match.");
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    redirect("/reset-password?error=This%20recovery%20link%20is%20invalid%20or%20has%20expired.");
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    redirect("/update-password?error=Unable%20to%20update%20your%20password.%20Check%20the%20password%20requirements%20and%20try%20again.");
  }

  const { data: auditSaved, error: auditError } = await supabase.rpc("neweix_record_password_changed_event");
  const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });

  if (auditError || auditSaved !== true) {
    redirect("/login?error=Password%20updated.%20Please%20contact%20support%20if%20you%20need%20help%20with%20your%20security%20record.");
  }
  if (signOutError) {
    redirect("/login?message=Password%20updated.%20Sign%20in%20again%20to%20finish%20securing%20your%20account.");
  }

  redirect("/login?message=Password%20updated.%20All%20devices%20have%20been%20signed%20out.%20Sign%20in%20again.");
}
