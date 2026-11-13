import Link from "next/link";
import { signUp } from "@/app/actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { error, message } = await searchParams;
  return <main className="auth-shell"><Link className="brand" href="/">Neweix</Link><section className="panel"><h1>Create account</h1>{error && <p className="notice error">{error}</p>}{message && <p className="notice success">{message}</p>}<form action={signUp}><label>Full name<input name="fullName" autoComplete="name" required maxLength={100} /></label><label>Username<input name="username" autoComplete="username" minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" required /><small>3–20 characters: letters, numbers, underscore.</small></label><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="new-password" minLength={12} required /></label><label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required /></label><button className="button primary full" type="submit">Create account</button></form><p className="links">Have an account? <Link href="/login">Sign in</Link></p></section></main>;
}
