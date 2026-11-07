import Link from "next/link";
import { signUp } from "@/app/actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { error, message } = await searchParams;
  return <main className="auth-shell"><Link className="brand" href="/">Neweix Account</Link><section className="panel"><p className="eyebrow">JOIN NEWEIX</p><h1>Create your account</h1><p className="muted">One account will connect you to Neweix services.</p>{error && <p className="notice error">{error}</p>}{message && <p className="notice success">{message}</p>}<form action={signUp}><label>Full name<input name="fullName" autoComplete="name" required maxLength={100} /></label><label>Username<input name="username" autoComplete="username" minLength={3} maxLength={30} pattern="[A-Za-z0-9_.-]+" required /><small>3–30 characters. Letters, numbers, dot, underscore and hyphen.</small></label><label>Email address<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="new-password" minLength={12} required /><small>Use at least 12 characters.</small></label><button className="button primary full" type="submit">Create Neweix Account</button></form><p className="links">Already have an account? <Link href="/login">Sign in</Link></p></section></main>;
}
