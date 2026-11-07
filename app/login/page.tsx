import Link from "next/link";
import { signIn } from "@/app/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { error, message } = await searchParams;
  return <main className="auth-shell"><Link className="brand" href="/">Neweix Account</Link><section className="panel"><p className="eyebrow">WELCOME BACK</p><h1>Sign in</h1><p className="muted">Use your Neweix Account credentials.</p>{error && <p className="notice error">{error}</p>}{message && <p className="notice success">{message}</p>}<form action={signIn}><label>Username or email<input name="identifier" type="text" autoComplete="username" required maxLength={254} /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label><button className="button primary full" type="submit">Sign in</button></form><div className="links"><Link href="/reset-password">Forgot password?</Link><span>New to Neweix? <Link href="/signup">Create an account</Link></span></div></section></main>;
}
