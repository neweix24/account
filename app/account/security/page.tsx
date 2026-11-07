import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { changePassword } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: liveSession, error: sessionError } = await supabase.rpc("neweix_validate_current_session");
  if (sessionError || liveSession !== true) redirect("/login?error=Your%20session%20is%20no%20longer%20valid.");

  const { data: profile } = await supabase
    .from("account")
    .select("account_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.account_status !== "active") redirect("/login?error=This%20account%20is%20not%20currently%20active.");

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaRequired = assurance?.nextLevel === "aal2";

  return (
    <main className="auth-shell">
      <Link className="brand" href="/account">Neweix Account</Link>
      <section className="panel wide">
        <p className="eyebrow">ACCOUNT PROTECTION</p>
        <h1>Password &amp; security</h1>
        <p className="muted">Change your password securely. Your current password is verified before the update.</p>
        {error && <p className="notice error" role="alert">{error}</p>}
        {message && <p className="notice" role="status">{message}</p>}
        <form action={changePassword}>
          <label>
            Current password
            <input name="currentPassword" type="password" autoComplete="current-password" required />
          </label>
          <label>
            New password
            <input name="newPassword" type="password" autoComplete="new-password" minLength={12} required />
          </label>
          <label>
            Confirm new password
            <input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required />
          </label>
          <p className="fine">Use at least 12 characters. Avoid reusing a password from another service.</p>
          {mfaRequired && <p className="fine">Authenticator verification is required before this change can be completed.</p>}
          <button className="button primary full" type="submit">Update password</button>
        </form>
        <p><Link href="/account/sessions">Manage signed-in devices</Link></p>
        <p><Link href="/mfa">Authenticator settings</Link></p>
        <p className="fine"><Link href="/account">Back to account</Link></p>
      </section>
    </main>
  );
}
