"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function revokeAccountSession(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    redirect("/account/sessions?error=Invalid%20session.");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("neweix_revoke_account_session", { p_session_id: sessionId });
  if (error || data !== true) redirect("/account/sessions?error=Unable%20to%20revoke%20that%20session.");
  redirect("/account/sessions?message=Session%20revoked.");
}

export async function signOutOtherSessions() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) redirect("/account/sessions?error=Unable%20to%20sign%20out%20other%20devices.");
  redirect("/account/sessions?message=All%20other%20sessions%20were%20signed%20out.");
}
