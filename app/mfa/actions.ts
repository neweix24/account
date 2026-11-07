"use server";

import { createClient } from "@/lib/supabase/server";

type ActionError = { ok: false; error: string };
type ActionSuccess = { ok: true };

export async function beginTotpEnrollment(): Promise<ActionError | {
  ok: true;
  factorId: string;
  qrCode: string;
  secret: string;
}> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, error: "Please sign in again." };

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Neweix Account authenticator",
  });
  if (error || !data?.totp?.qr_code || !data.totp.secret) {
    return { ok: false, error: error?.message ?? "Could not start authenticator setup." };
  }

  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyTotp(factorId: string, code: string): Promise<ActionError | ActionSuccess> {
  if (!/^[a-zA-Z0-9-]{10,100}$/.test(factorId) || !/^\d{6,8}$/.test(code)) {
    return { ok: false, error: "Enter a valid authenticator code." };
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, error: "Please sign in again." };

  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) {
    return { ok: false, error: challengeError?.message ?? "Could not start verification." };
  }

  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeTotpFactor(factorId: string): Promise<ActionError | ActionSuccess> {
  if (!/^[a-zA-Z0-9-]{10,100}$/.test(factorId)) return { ok: false, error: "Invalid authenticator." };

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, error: "Please sign in again." };

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") {
    return { ok: false, error: "Verify your authenticator before removing it." };
  }

  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { ok: false, error: listError.message };

  const factor = factors?.all.find((item) => item.id === factorId && item.status === "verified");
  if (!factor) return { ok: false, error: "Authenticator not found." };

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
