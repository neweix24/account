import Link from "next/link";
import { signUp } from "@/app/actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { error, message } = await searchParams;
  return (
    <main className="auth-shell">
      <Link className="brand" href="/">Neweix</Link>
      <section className="panel signup-panel">
        <p className="eyebrow">ONE IDENTITY. EVERY NEWEIX SERVICE.</p>
        <h1>Create your Account</h1>
        <p className="muted signup-intro">Start with the essentials. You can complete your profile and add a Business Profile later.</p>
        {error && <p className="notice error" role="alert">{error}</p>}
        {message && <p className="notice success" role="status">{message}</p>}
        <form action={signUp}>
          <div className="form-section-title">Your identity</div>
          <label>Full name<input name="fullName" autoComplete="name" required maxLength={100} placeholder="Enter your full name" /></label>
          <label>Username<input name="username" autoComplete="username" minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" autoCapitalize="none" autoCorrect="off" required placeholder="Choose a unique username" /><small>3–20 characters. English letters, numbers and underscores.</small></label>
          <div className="form-section-title">Sign-in details</div>
          <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /><small>We will send a verification link to this address.</small></label>
          <label>Password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required placeholder="At least 12 characters" /></label>
          <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required placeholder="Enter your password again" /></label>
          <label className="select-label">Preferred language
            <select name="preferredLanguage" defaultValue="en">
              <option value="en">English</option>
              <option value="bn">বাংলা</option>
            </select>
            <small>You can change this later in Account settings.</small>
          </label>
          <label className="consent-row">
            <input name="acceptTerms" type="checkbox" value="yes" required />
            <span>I agree to the Neweix Terms of Service and Privacy Policy. I understand that my Account is the central identity for Neweix services.</span>
          </label>
          <button className="button primary full" type="submit">Create Neweix Account</button>
        </form>
        <div className="signup-note"><strong>Your privacy matters.</strong> We do not need your NID, date of birth, Facebook friends or Google account access to create a basic Neweix Account.</div>
        <p className="links">Already have an Account? <Link href="/login">Sign in</Link></p>
      </section>
    </main>
  );
}
