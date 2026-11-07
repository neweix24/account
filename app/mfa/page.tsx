import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import MfaPanel from "@/app/mfa/mfa-panel";
export const dynamic = "force-dynamic";
export default async function MfaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: factorData } = await supabase.auth.mfa.listFactors();
  const factors = factorData?.all ?? [];
  if (assurance?.currentLevel === "aal1" && assurance?.nextLevel === "aal2") {
    return <main className="auth-shell"><Link className="brand" href="/">Neweix Account</Link><MfaPanel mode="challenge" factors={factors} /></main>;
  }
  return <main className="auth-shell"><Link className="brand" href="/account">Neweix Account</Link><MfaPanel mode="settings" factors={factors} /><p className="fine"><Link href="/account">Back to account</Link></p></main>;
}
