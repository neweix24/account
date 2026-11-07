import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="shell">
      <header className="topbar"><span className="brand">Neweix Account</span><span className="muted">One identity. Every Neweix service.</span></header>
      <section className="hero">
        <p className="eyebrow">YOUR CENTRAL ACCOUNT</p>
        <h1>One account for your Neweix world.</h1>
        <p className="lead">Create and secure your Neweix identity, then use it to access approved Neweix services.</p>
        <div className="actions">
          {user ? <Link className="button primary" href="/account">Open your account</Link> : <><Link className="button primary" href="/signup">Create Neweix Account</Link><Link className="button secondary" href="/login">Sign in</Link></>}
        </div>
        <p className="fine">Independent Neweix sign-in. No Google or Facebook login.</p>
      </section>
      <footer>Neweix Account · Central identity and access</footer>
    </main>
  );
}
