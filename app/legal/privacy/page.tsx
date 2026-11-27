import Link from "next/link";

export default function PrivacyPage() {
  return <main className="auth-shell"><Link className="brand" href="/signup">Neweix</Link><article className="panel wide legal-panel">
    <p className="eyebrow">NEWEIX ACCOUNT</p><h1>Privacy Policy</h1><p className="muted">Version 1.0 · Effective 27 November 2026</p>
    <h2>1. Information we collect</h2><p>For basic registration, Neweix collects your name, username, email address, password credential handled by the authentication provider, language preference, and the date/version of your Terms and Privacy Policy acceptance. Contact verification status and security events are recorded to protect your Account.</p>
    <h2>2. Optional information</h2><p>Profile photo, display name, phone number, Business Profile details and other profile information may be added when you choose to use related features. Government identity documents are not required for ordinary registration. We do not request access to your Google or Facebook account, contacts, friends, mail, files or social activity.</p>
    <h2>3. How information is used</h2><p>We use Account information to create and secure your identity, verify contact ownership, provide Account recovery, prevent abuse, support your chosen profiles, and enable approved first-party Neweix services.</p>
    <h2>4. Sharing and service access</h2><p>Neweix services should receive only the identity claims and access required for their functions through reviewed first-party integration contracts. Account credentials, passwords and private security records must not be shared with other services. We do not sell personal information.</p>
    <h2>5. Retention and control</h2><p>We retain information for as long as needed to operate and secure your Account, meet legal obligations, resolve disputes and preserve required audit records. You may request correction or closure through the official support channel, subject to legal and security retention requirements.</p>
    <h2>6. Security and updates</h2><p>We use access controls and security measures appropriate to the information handled. No online service can guarantee absolute security. We will update this policy when our data practices materially change and request renewed consent where required.</p>
    <h2>7. Contact</h2><p>Use the support channel published on the official Neweix website for privacy requests.</p>
    <p className="fine">This initial policy text is a product baseline and should receive jurisdiction-specific legal review before broad production use.</p><Link href="/signup">Back to registration</Link>
  </article></main>;
}
