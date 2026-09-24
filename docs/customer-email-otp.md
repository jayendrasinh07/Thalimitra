# Customer signup email OTP rollout

The customer app has a six-digit signup verification screen and Supabase `verifyOtp`/`resend` calls. It stays behind `VITE_CUSTOMER_EMAIL_OTP_ENABLED=true` until the production email sender and template are verified. With the flag unset, the existing confirmation-link flow remains active.

## Production sequence

1. Configure a transactional SMTP sender on the Thalimitra Supabase project using a verified sending domain. Resend Free is suitable for the pilot at up to 100 emails/day and 3,000/month; use its [Supabase SMTP guide](https://resend.com/docs/send-with-supabase-smtp). Store credentials only in Supabase Auth SMTP settings; do not commit them. The project's default Free-tier sender cannot serve arbitrary customer addresses or edit templates.
2. Change **Auth → Email Templates → Confirm sign up** to include both the six-digit token and confirmation link. Keep the link for older APKs:

   ```html
   <h2>Verify your Thalimitra email</h2>
   <p>Your verification code is <strong>{{ .Token }}</strong>.</p>
   <p>Enter the code in the app. If your app asks for a link instead, <a href="{{ .ConfirmationURL }}">confirm your email here</a>.</p>
   <p>If you did not create an account, ignore this email. Never share the code.</p>
   ```

3. From a fresh test customer address, verify code delivery, valid/invalid code handling, resend rate limits, sign-in, and the older confirmation link. Do not create production test orders.
4. Set `VITE_CUSTOMER_EMAIL_OTP_ENABLED=true` for the Cloudflare customer build and Android release build, then deploy both. Do not set it for Operations.

Supabase references: [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [OTP verification](https://supabase.com/docs/reference/javascript/auth-verifyotp).
