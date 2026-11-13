# Neweix Account messaging providers

Neweix owns identity, OTP generation and verification, expiry, attempt limits, and account authorization. Messaging vendors only deliver the messages.

## Provider assignments

- **Resend** — Supabase Auth email confirmation, email OTP/magic links, password recovery, and account-security email.
- **BulkSMSBD** — Supabase Auth phone OTP and phone-verification SMS for Bangladesh mobile numbers.

Do not use either provider as an identity provider. Google, Facebook, Apple, and other third-party login providers remain out of scope.

## Resend: Supabase Auth SMTP

Use Resend as the custom SMTP server for Supabase Auth. This keeps Supabase responsible for creating and validating Auth tokens while Resend handles delivery.

In Resend:
1. Confirm the Neweix sending domain is verified. The existing `send.neweix.com` and `rsend.neweix.com` DNS records are part of the current Resend setup; do not delete or replace them.
2. Create a restricted API key for SMTP sending.
3. Use a From address on the verified sending domain.

In Supabase Dashboard → Authentication → SMTP Settings, configure:

- Enable Custom SMTP: on
- Host: `smtp.resend.com`
- Port: `465` (implicit TLS) or `587` (STARTTLS)
- Username: `resend`
- Password: the Resend API key (store only in Supabase Auth SMTP settings)
- Sender email: an approved address on the verified Neweix sending domain
- Sender name: `Neweix Account`

Keep email confirmations enabled and keep the existing PKCE confirmation and password-recovery callback URLs. Do not enable auto-confirm to work around delivery problems.

Use the Supabase Auth email templates for confirmation, OTP and recovery messages. Keep them transactional, short, and free of marketing content. Test signup confirmation, resend confirmation, password recovery, and email-change confirmation after SMTP is configured.

## BulkSMSBD: Supabase Send SMS Auth Hook

The repository includes `supabase/functions/send-sms/index.ts`. It implements Supabase's signed Send SMS Auth Hook and calls the BulkSMSBD single-SMS endpoint from the server:

- Endpoint: `https://bulksmsbd.net/api/smsapi`
- Method: `POST`
- Content type: `application/x-www-form-urlencoded`
- Parameters: `api_key`, `senderid`, `number`, `message`, `type=text`
- Accepted provider response code: `202`

The hook:
- Verifies the Supabase Standard Webhooks signature and timestamp before reading the OTP.
- Accepts Bangladesh mobile numbers in `01XXXXXXXXX` or `8801XXXXXXXXX` form and normalizes them to `8801XXXXXXXXX`.
- Sends only the OTP supplied by Supabase Auth; it does not generate or verify OTPs.
- Rejects malformed phone numbers, malformed OTPs, invalid signatures, and provider errors.
- Does not log or return the OTP, API key, recipient number, or raw provider response.
- Fails closed if the provider is not configured or rejects the request.

### Required Supabase Edge Function secrets

Set these values in the existing Neweix Supabase project. Do not commit them or put them in any `NEXT_PUBLIC_*` variable.

- `SEND_SMS_HOOK_SECRET` — signing secret generated for the Supabase Send SMS Auth Hook, including its `v1,whsec_` prefix.
- `BULKSMSBD_API_KEY` — API key from the BulkSMSBD panel.
- `BULKSMSBD_SENDER_ID` — approved sender ID configured for that API key.

Deploy the function:

```sh
supabase functions deploy send-sms --no-verify-jwt
supabase secrets set SEND_SMS_HOOK_SECRET='v1,whsec_REPLACE_WITH_HOOK_SECRET' BULKSMSBD_API_KEY='REPLACE_WITH_API_KEY' BULKSMSBD_SENDER_ID='REPLACE_WITH_APPROVED_SENDER_ID'
```

Then, in Supabase Dashboard → Authentication → Hooks:
1. Enable the **Send SMS** hook.
2. Choose the HTTP endpoint option.
3. Set the endpoint to `https://<PROJECT_REF>.supabase.co/functions/v1/send-sms`.
4. Configure the signing secret and ensure it matches `SEND_SMS_HOOK_SECRET` exactly.
5. Save the hook.

In Authentication → Providers → Phone:
- Enable phone authentication only when the BulkSMSBD hook and secrets are configured.
- Keep phone confirmation enabled; do not auto-confirm phone numbers.
- Keep OTP expiry and resend/verification rate limits enabled.

The current Account UI supports email/password signup and login. This hook is the SMS delivery foundation for Supabase phone OTP; a phone-number signup/login UI and end-to-end account flow are a separate implementation task and must be tested before advertising phone login as available.

## Security and acceptance checks

Before production use, verify all of the following in the existing Neweix Supabase project:

1. A valid signed hook request reaches BulkSMSBD and receives provider response code `202`.
2. Invalid, missing, or stale webhook signatures are rejected without contacting BulkSMSBD.
3. Non-Bangladesh or malformed phone numbers are rejected.
4. Provider errors and timeouts return a failure to Supabase Auth; they are never reported as successful delivery.
5. OTP values, phone numbers, API keys, SMTP passwords, and raw provider responses do not appear in application logs.
6. Supabase Auth itself verifies the OTP and enforces expiry, attempt limits, and rate limits.
7. Email confirmation and password recovery arrive through Resend and retain the correct PKCE callback URLs.
8. A delivery-provider outage never disables or bypasses account verification.

A BulkSMSBD HTTP `202` means the provider accepted the SMS submission; it is not proof that the handset received the message. Confirm delivery separately in the BulkSMSBD delivery report.
