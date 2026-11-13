# Neweix Account authentication policy

## Passwords

- Signup, password recovery, and authenticated password changes share one policy.
- Passwords must contain 12–128 characters.
- Password confirmation must match exactly.

## Optional two-factor authentication

Two-factor authentication (2FA) is optional for Neweix Account.

- Users may enable TOTP authenticator verification from Account Security settings.
- Users who do not enable 2FA continue to sign in using the normal password flow. They are not forced to enroll or complete an MFA challenge.
- Once a TOTP factor is verified, the next sign-in must complete the authenticator challenge before protected Account access is granted.
- Removing a verified factor requires an AAL2-authenticated session.
- Users can manage 2FA from Account Security settings.
- No global project-wide MFA enrollment requirement is intended.

## Release verification still required

Verify both paths with dedicated test accounts before production sign-off:

1. Account without 2FA: signup/login/recovery and protected page access without an MFA challenge.
2. Account with 2FA: enrollment, sign-out/sign-in challenge, invalid/expired code rejection, and factor removal after AAL2 verification.

Do not use real user accounts for destructive acceptance tests. Keep SMS OTP disabled until provider delivery and abuse controls pass a controlled test.
