"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidAccountPassword, passwordsMatch } from "@/lib/auth/validation";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function getSiteOrigin(): Promise<string | null> {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();

  if (host === "www.accounts.neweix.com" || host === "accounts.neweix.com") return "https://www.accounts.neweix.com";
  if (host === "localhost:3000") return "http://localhost:3000";
  if (/^[a-z0-9.-]+\.workers\.dev$/.test(host)) return `https://${host}`;

  return process.env.NEXT_PUBLIC_SITE_URL ?? null;
}

export async function signUp(formData: FormData) {
  const fullName = value(formData, "fullName");
  const username = value(formData, "username").toLowerCase();
  const email = value(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const preferredLanguage = value(formData, "preferredLanguage");
  const acceptTerms = formData.get("acceptTerms") === "yes";

  if (!fullName || fullName.length > 100 || !/^[a-z0-9_]{3,20}$/.test(username) ||
      !/^[^@ ]+@[^@ ]+[.][^@ .]+$/.test(email) || email.length > 254 ||
      !["en", "bn"].includes(preferredLanguage) || !acceptTerms ||
      !isValidAccountPassword(password) || !passwordsMatch(password, confirmPassword)) {
    redirect("/signup?error=Check%20your%20details.%20Username%20must%20be%203%E2%80%9320%20characters%20and%20passwords%20must%20match.%20Passwords%20must%20be%2012%E2%80%93128%20characters.");
  }

  const siteUrl = await getSiteOrigin();
  if (!siteUrl) redirect("/signup?error=Sign-up%20is%20temporarily%20unavailable.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm`,
      data: {
        full_name: fullName,
        username,
        identity_type: "customer",
        preferred_language: preferredLanguage,
        terms_accepted: true,
        terms_version: "1.0",
        privacy_version: "1.0",
      },
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
    const message = response.status === 429
      ? "Too many sign-in attempts. Try again in 15 minutes."
      : "Sign-in failed. Check your credentials and verification.";
    redirect(`/login?error=${encodeURIComponent(message)}`);
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

export async function changeUsername(formData: FormData) {
  const username = value(formData, "username").toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    redirect("/account?username_error=invalid_username");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("neweix_change_account_username", {
    p_username: username,
  });

  if (error) redirect("/account?username_error=temporarily_unavailable");
  if (!data?.success) {
    const code = typeof data?.code === "string" ? data.code : "temporarily_unavailable";
    const allowed = new Set([
      "session_required", "invalid_username", "account_unavailable", "same_username",
      "cooldown", "username_taken", "username_reserved", "reservation_conflict",
    ]);
    redirect(`/account?username_error=${allowed.has(code) ? code : "temporarily_unavailable"}`);
  }

  redirect("/account?username_message=updated");
}


export async function createBusinessProfile(formData: FormData) {
  const businessName = value(formData, "businessName");
  const businessCategory = value(formData, "businessCategory");
  if (businessName.length < 2 || businessName.length > 120 || businessCategory.length > 80) {
    redirect("/account?profile_error=invalid_business");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("neweix_create_business_profile", {
    p_business_name: businessName,
    p_business_category: businessCategory || null,
  });
  if (error) redirect("/account?profile_error=profile_unavailable");
  revalidatePath("/account");
  redirect("/account?profile_message=business_created");
}

export async function setDefaultProfile(formData: FormData) {
  const profileId = value(formData, "profileId");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId)) {
    redirect("/account?profile_error=invalid_profile");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("neweix_set_default_profile", { p_profile_id: profileId });
  if (error) redirect("/account?profile_error=profile_unavailable");
  revalidatePath("/account");
  redirect("/account?profile_message=profile_switched");
}
