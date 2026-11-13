import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import MfaPanel from "@/app/mfa/mfa-panel";

export const dynamic = "force-dynamic";

export default async function MfaPage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { data: liveSession, error: sessionError } = await supabase.rpc("neweix_validate_current_session");
  if (sessionError || liveSession !== true) redirect("/login?error=Your%20session%20is%20no%20longer%20active.");

  const { data: profile, error: profileError } = await supabase
    .from("account")
    .select("account_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError || profile?.account_status !== "active") {
    redirect("/login?error=This%20account%20is%20not%20currently%20active.");
  }

  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) redirect("/login?error=Unable%20to%20verify%20your%20security%20session.");
  const { data: factorData, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) redirect("/account/security?error=Unable%20to%20load%20authenticators.");
  const factors = factorData?.all ?? [];

  if (assurance?.currentLevel === "aal1" && assurance?.nextLevel === "aal2") {
    return <main className="auth-shell"><Link className="brand" href="/">Neweix Account</Link><MfaPanel mode="challenge" factors={factors} /></main>;
  }
  return <main className="auth-shell"><Link className="brand" href="/account">Neweix Account</Link><MfaPanel mode="settings" factors={factors} /><p className="fine"><Link href="/account">Back to account</Link></p></main>;
}
