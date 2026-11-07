import Link from "next/link";
import { updatePassword } from "./actions";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="auth-shell"><Link className="brand" href="/">Neweix Account</Link><section className="panel"><p className="eyebrow">SECURE YOUR ACCOUNT</p><h1>Choose a new password</h1>{error && <p className="notice error">{error}</p>}<form action={updatePassword}><label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} required /></label><label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required /></label><button className="button primary full" type="submit">Update password</button></form></section></main>;
}
