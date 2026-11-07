"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function backWithError(message: string): never {
  redirect(`/account/security?error=${encodeURIComponent(message)}`);
}

export async function changePassword(formData: FormData) {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword) backWithError("Enter your current password and a new password.");
  if (newPassword.length < 12) backWithError("Your new password must contain at least 12 characters.");
  if (newPassword !== confirmPassword) backWithError("The new passwords do not match.");
  if (currentPassword === newPassword) backWithError("Choose a password you have not used for this account.");

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login?error=Please%20sign%20in%20again.");

  const { data: liveSession, error: sessionError } = await supabase.rpc("neweix_validate_current_session");
  if (sessionError || liveSession !== true) redirect("/login?error=Your%20session%20is%20no%20longer%20valid.");

  const { data: profile, error: profileError } = await supabase
    .from("neweix_accounts")
    .select("account_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || profile?.account_status !== "active") {
    redirect("/login?error=This%20account%20is%20not%20currently%20active.");
  }

  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) backWithError("Could not verify your security level. Please try again.");
  if (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2") {
    redirect("/mfa?next=%2Faccount%2Fsecurity");
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
    current_password: currentPassword,
  });

  if (updateError) {
    const message = /password/i.test(updateError.message)
      ? "The current password may be incorrect, or the new password does not meet security requirements."
      : "Unable to update your password. Please try again.";
    backWithError(message);
  }

  const { data: auditSaved, error: auditError } = await supabase.rpc("neweix_record_password_changed_event");
  const { error: sessionsError } = await supabase.auth.signOut({ scope: "others" });

  if (auditError || auditSaved !== true) {
    backWithError("Your password was changed, but the security event could not be recorded. Please contact support.");
  }
  if (sessionsError) {
    backWithError("Your password was changed, but other sessions could not be revoked. Use Sessions & devices to sign them out.");
  }

  redirect("/account/security?message=Password%20updated.%20Other%20devices%20were%20signed%20out.");
}
