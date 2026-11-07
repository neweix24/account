import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { revokeAccountSession, signOutOtherSessions } from "./actions";

export const dynamic = "force-dynamic";

type AccountSession = {
  session_id: string;
  created_at: string | null;
  updated_at: string | null;
  refreshed_at: string | null;
  user_agent: string | null;
  assurance_level: string | null;
  is_current: boolean;
};

function deviceDescription(userAgent: string | null) {
  if (!userAgent) return "Unknown device";
  const os = /Android/i.test(userAgent) ? "Android" :
    /iPhone|iPad|iPod/i.test(userAgent) ? "iOS" :
    /Windows/i.test(userAgent) ? "Windows" :
    /Mac OS|Macintosh/i.test(userAgent) ? "macOS" :
    /Linux/i.test(userAgent) ? "Linux" : "Unknown operating system";
  const browser = /Edg\//i.test(userAgent) ? "Microsoft Edge" :
    /Firefox\//i.test(userAgent) ? "Firefox" :
    /Chrome\//i.test(userAgent) ? "Chrome" :
    /Safari\//i.test(userAgent) ? "Safari" : "Unknown browser";
  return `${browser} · ${os}`;
}

function dateLabel(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export default async function AccountSessionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel === "aal1" && assurance?.nextLevel === "aal2") redirect("/mfa");

  const { data, error } = await supabase.rpc("neweix_list_account_sessions");
  const sessions = (data ?? []) as AccountSession[];

  return (
    <main className="auth-shell">
      <header className="account-head">
        <Link className="brand" href="/account">Neweix Account</Link>
        <Link className="button secondary" href="/account">Back to account</Link>
      </header>
      <section className="panel wide">
        <p className="eyebrow">ACCOUNT SECURITY</p>
        <h1>Sessions & devices</h1>
        <p className="muted">Review where your Neweix Account is signed in. Remove a session you no longer recognize.</p>
        {error ? (
          <p className="notice error">Unable to load sessions right now. Please refresh and try again.</p>
        ) : sessions.length === 0 ? (
          <p className="muted">No active sessions were found.</p>
        ) : (
          <div className="session-list">
            {sessions.map((session) => (
              <article className="session-item" key={session.session_id}>
                <div className="session-info">
                  <strong>{deviceDescription(session.user_agent)}</strong>
                  <span className="muted">{session.is_current ? "This device · Current session" : "Other signed-in device"}</span>
                  <span className="fine">Last refreshed: {dateLabel(session.refreshed_at ?? session.updated_at)}</span>
                  <span className="fine">Signed in: {dateLabel(session.created_at)}</span>
                  <span className="fine">Security level: {session.assurance_level ?? "Not available"}</span>
                </div>
                {!session.is_current && (
                  <form action={revokeAccountSession}>
                    <input type="hidden" name="sessionId" value={session.session_id} />
                    <button className="button danger" type="submit">Sign out</button>
                  </form>
                )}
              </article>
            ))}
          </div>
        )}
        {sessions.some((session) => !session.is_current) && (
          <form action={signOutOtherSessions} className="session-actions">
            <button className="button danger" type="submit">Sign out all other devices</button>
          </form>
        )}
        <p className="fine">Revoking a session blocks future refreshes. An already-issued access token may remain valid until it expires; sensitive services should also validate the session ID against Supabase Auth.</p>
      </section>
    </main>
  );
}
