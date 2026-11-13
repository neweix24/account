import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="shell">
      <header className="topbar"><span className="brand">Neweix</span></header>
      <section className="hero">
        <h1>Neweix Account</h1>
        <div className="actions">
          {user ? <Link className="button primary" href="/account">Open account</Link> : <><Link className="button primary" href="/signup">Create account</Link><Link className="button secondary" href="/login">Sign in</Link></>}
        </div>
      </section>
    </main>
  );
}
