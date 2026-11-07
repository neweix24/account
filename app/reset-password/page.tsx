import Link from "next/link";
import { requestPasswordReset } from "@/app/actions";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams;
  return <main className="auth-shell"><Link className="brand" href="/">Neweix Account</Link><section className="panel"><p className="eyebrow">ACCOUNT RECOVERY</p><h1>Reset your password</h1><p className="muted">Enter your account email. If it is registered, recovery instructions will be sent.</p>{message && <p className="notice success">{message}</p>}<form action={requestPasswordReset}><label>Email address<input name="email" type="email" autoComplete="email" required /></label><button className="button primary full" type="submit">Send recovery email</button></form><p className="links"><Link href="/login">Back to sign in</Link></p></section></main>;
}
