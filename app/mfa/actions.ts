"use server";
import { createClient } from "@/lib/supabase/server";
export async function beginTotpEnrollment(): Promise<{ error: string; factorId?: never; qrCode?: never; secret?: never } | { error?: never; factorId: string; qrCode: string; secret: string }> {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Please sign in again." };
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Neweix Account authenticator" });
  if (error || !data?.totp) return { error: error?.message ?? "Could not start authenticator setup." };
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}
export async function verifyTotp(factorId: string, code: string): Promise<{ error: string } | { success: true }> {
  if (!/^[a-zA-Z0-9-]{10,100}$/.test(factorId) || !/^\d{6,8}$/.test(code)) return { error: "Enter a valid authenticator code." };
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Please sign in again." };
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge) return { error: challengeError?.message ?? "Could not start verification." };
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
  if (error) return { error: error.message };
  return { success: true };
}
export async function removeTotpFactor(factorId: string): Promise<{ error: string } | { success: true }> {
  if (!/^[a-zA-Z0-9-]{10,100}$/.test(factorId)) return { error: "Invalid authenticator." };
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Please sign in again." };
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") return { error: "Verify your authenticator before removing it." };
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return { error: listError.message };
  const factor = factors?.all.find((item) => item.id === factorId && item.status === "verified");
  if (!factor) return { error: "Authenticator not found." };
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: error.message };
  return { success: true };
}
