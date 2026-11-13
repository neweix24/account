import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PhoneVerification from "./phone-verification";

export const dynamic = "force-dynamic";

export default async function AccountPhonePage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { data: liveSession, error: sessionError } = await supabase.rpc("neweix_validate_current_session");
  if (sessionError || liveSession !== true) redirect("/login?error=Your%20session%20is%20no%20longer%20valid.");

  const { data: profile, error: profileError } = await supabase
    .from("account")
    .select("account_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || profile?.account_status !== "active") {
    redirect("/login?error=This%20account%20is%20not%20currently%20active.");
  }

  return (
    <main className="auth-shell">
      <Link className="brand" href="/account">Neweix Account</Link>
      <PhoneVerification />
      <p className="fine"><Link href="/account">Back to account</Link></p>
    </main>
  );
}
