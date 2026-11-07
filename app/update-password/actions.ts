"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (password.length < 12 || password !== confirmPassword) {
    redirect("/update-password?error=Passwords%20must%20match%20and%20contain%20at%20least%2012%20characters.");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=Please%20use%20a%20valid%20recovery%20link.");

  const { data: liveSession, error: sessionError } = await supabase.rpc("neweix_validate_current_session");
  if (sessionError || liveSession !== true) {
    redirect("/login?error=Please%20use%20a%20valid%20recovery%20link.");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/update-password?error=Unable%20to%20update%20password.%20Please%20try%20again.");

  const { data: auditSaved, error: auditError } = await supabase.rpc("neweix_record_password_changed_event");
  await supabase.auth.signOut({ scope: "global" });

  if (auditError || auditSaved !== true) {
    redirect("/login?error=Password%20updated.%20Please%20sign%20in%20again.%20Security%20event%20logging%20needs%20support%20review.");
  }
  redirect("/login?message=Password%20updated.%20Please%20sign%20in%20again.");
}
