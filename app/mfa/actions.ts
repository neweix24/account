"use server";

import { createClient } from "@/lib/supabase/server";

type ActionError = { ok: false; error: string };
type ActionSuccess = { ok: true };

async function getActiveAccountClient(): Promise<ActionError | {
  ok: true;
  supabase: Awaited<ReturnType<typeof createClient>>;
}> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, error: "Please sign in again." };

  const { data: liveSession, error: sessionError } = await supabase.rpc("neweix_validate_current_session");
  if (sessionError || liveSession !== true) {
    return { ok: false, error: "Your session is no longer active. Please sign in again." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("account")
    .select("account_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || profile?.account_status !== "active") {
    return { ok: false, error: "This account is not currently active." };
  }

  return { ok: true, supabase };
}

export async function beginTotpEnrollment(): Promise<ActionError | {
  ok: true;
  factorId: string;
  qrCode: string;
  secret: string;
}> {
  const access = await getActiveAccountClient();
  if (!access.ok) return access;

  const { data: existingFactors, error: factorsError } = await access.supabase.auth.mfa.listFactors();
  if (factorsError) {
    return { ok: false, error: "Could not verify your authenticator settings. Please try again." };
  }
  const hasVerifiedTotp = (existingFactors?.all ?? []).some(
    (factor) => factor.factor_type === "totp" && factor.status === "verified",
  );
  if (hasVerifiedTotp) {
    const { data: assurance, error: assuranceError } =
      await access.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance?.currentLevel !== "aal2") {
      return { ok: false, error: "Verify your existing authenticator before adding another one." };
    }
  }

  const { data, error } = await access.supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Neweix Account authenticator",
  });
  if (error || !data?.totp?.qr_code || !data.totp.secret) {
    return { ok: false, error: "Could not start authenticator setup. Please try again." };
  }

  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyTotp(factorId: string, code: string): Promise<ActionError | ActionSuccess> {
  if (!/^[a-zA-Z0-9-]{10,100}$/.test(factorId) || !/^\d{6,8}$/.test(code)) {
    return { ok: false, error: "Enter a valid authenticator code." };
  }

  const access = await getActiveAccountClient();
  if (!access.ok) return access;

  const { data: challenge, error: challengeError } = await access.supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) {
    return { ok: false, error: "Could not start authenticator verification. Please try again." };
  }

  const { error } = await access.supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  if (error) return { ok: false, error: "The authenticator code is invalid or expired." };
  return { ok: true };
}

export async function removeTotpFactor(factorId: string): Promise<ActionError | ActionSuccess> {
  if (!/^[a-zA-Z0-9-]{10,100}$/.test(factorId)) return { ok: false, error: "Invalid authenticator." };

  const access = await getActiveAccountClient();
  if (!access.ok) return access;

  const { data: assurance, error: assuranceError } = await access.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || assurance?.currentLevel !== "aal2") {
    return { ok: false, error: "Verify your authenticator before removing it." };
  }

  const { data: factors, error: listError } = await access.supabase.auth.mfa.listFactors();
  if (listError) return { ok: false, error: "Could not load your authenticators. Please try again." };

  const factor = factors?.all.find((item) => item.id === factorId && item.status === "verified");
  if (!factor) return { ok: false, error: "Authenticator not found." };

  const { error } = await access.supabase.auth.mfa.unenroll({ factorId });
  if (error) return { ok: false, error: "Could not remove the authenticator. Please try again." };
  return { ok: true };
}
