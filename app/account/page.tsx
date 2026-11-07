import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel === "aal1" && assurance?.nextLevel === "aal2") redirect("/mfa");
  const { data: profile } = await supabase.from("neweix_accounts").select("username,full_name,display_name,email,phone,account_status,created_at").eq("user_id", user.id).maybeSingle();
  if (profile?.account_status !== "active") redirect("/login?error=This%20account%20is%20not%20currently%20active.");
  const displayName = profile?.display_name ?? profile?.full_name;
  return <main className="auth-shell"><header className="account-head"><span className="brand">Neweix Account</span><form action={signOut}><button className="button secondary" type="submit">Sign out</button></form></header><section className="panel wide"><p className="eyebrow">YOUR IDENTITY</p><h1>Welcome{displayName ? ", " + displayName : ""}</h1><p className="muted">Your central Neweix identity.</p><dl className="profile"><div><dt>Username</dt><dd>{profile?.username ?? "—"}</dd></div><div><dt>Email</dt><dd>{profile?.email ?? user.email ?? "—"}</dd></div><div><dt>Mobile</dt><dd>{profile?.phone ?? "Not added"}</dd></div><div><dt>Account status</dt><dd>{profile?.account_status ?? "Pending"}</dd></div><div><dt>Account created</dt><dd>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-US") : "—"}</dd></div></dl><p><Link href="/mfa">Security settings · Authenticator app</Link></p><p className="fine">Service access and permissions are managed separately by each Neweix service.</p></section></main>;
}
