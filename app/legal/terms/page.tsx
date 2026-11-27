import Link from "next/link";

export default function TermsPage() {
  return <main className="auth-shell"><Link className="brand" href="/signup">Neweix</Link><article className="panel wide legal-panel">
    <p className="eyebrow">NEWEIX ACCOUNT</p><h1>Terms of Service</h1><p className="muted">Version 1.0 · Effective 27 November 2026</p>
    <h2>1. Account ownership</h2><p>You are responsible for the accuracy of the information you submit and for keeping your sign-in credentials secure. One person should maintain one Neweix Account. Your Account ID is permanent; your username is subject to the published change and reservation rules.</p>
    <h2>2. Profiles and services</h2><p>Your Account may contain Personal and Business Profiles. Profiles do not create separate Accounts or separate Eixon Wallets. Each Neweix service may apply its own terms and access controls.</p>
    <h2>3. Acceptable use</h2><p>Do not impersonate others, abuse verification or recovery systems, attempt unauthorized access, or use Neweix services unlawfully. We may restrict access where required for security, legal compliance, or enforcement of service policies.</p>
    <h2>4. Security</h2><p>Keep your email, phone and password secure. Enable additional authentication where available. Contact Neweix support promptly if you suspect unauthorized access.</p>
    <h2>5. Changes and closure</h2><p>We may update these terms. Material changes should be presented for renewed acceptance where required. Account closure and retention of records are handled under applicable law and the Neweix Privacy Policy.</p>
    <h2>6. Contact</h2><p>Use the support channel published on the official Neweix website for account-related requests.</p>
    <p className="fine">This initial policy text is a product baseline and should receive jurisdiction-specific legal review before broad production use.</p><Link href="/signup">Back to registration</Link>
  </article></main>;
}
