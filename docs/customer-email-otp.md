# Customer signup email OTP rollout

The customer app has an eight-digit signup verification screen and Supabase `verifyOtp`/`resend` calls, matching the hosted project's Email OTP length setting. The Customer Cloudflare build now sets `VITE_CUSTOMER_EMAIL_OTP_ENABLED=true`; Operations does not. The sign-up email keeps the confirmation link for older APKs.

## Production sequence

1. Resend verified `auth.thalimitra.com`, and Supabase Auth custom SMTP sends from `no-reply@auth.thalimitra.com`. Keep SMTP credentials only in Supabase and the restricted Resend key; never commit them. Resend Free is suitable for the pilot at up to 100 emails/day and 3,000/month; see its [Supabase SMTP guide](https://resend.com/docs/send-with-supabase-smtp).
2. **Auth → Email Templates → Confirm sign up** contains both the eight-digit token and confirmation link. Keep the link for older APKs:

   ```html
   <h2>Verify your Thalimitra email</h2>
   <p>Your verification code is <strong>{{ .Token }}</strong>.</p>
   <p>Enter the code in the app. If your app asks for a link instead, <a href="{{ .ConfirmationURL }}">confirm your email here</a>.</p>
   <p>If you did not create an account, ignore this email. Never share the code.</p>
   ```

3. A fresh test customer received the email, an invalid code was rejected, the valid code verified, and password sign-in succeeded. A customer password-reset email also arrived. Resend throttling, expiry, and the older APK link remain separate checks. Do not create production test orders.
4. The Cloudflare Customer build is live with the OTP flag and 8-digit screen. `npm run android:sync` enables the same flag for the Android Preview build. Older installed APKs still show the confirmation-link instructions until updated. The Android release still needs the established signing keystore, authorized phone connection, signed APK verification, and a physical-device smoke test. Do not set this flag for Operations.
5. Supabase may accept a repeated sign-up request for an already confirmed address without sending another verification email. Keep the UI message conditional; direct existing customers to sign-in or password reset without exposing whether an address is registered.

Supabase references: [email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [OTP verification](https://supabase.com/docs/reference/javascript/auth-verifyotp).
