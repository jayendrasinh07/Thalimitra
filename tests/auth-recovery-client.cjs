const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const customerRecoveryFunction = readFileSync('supabase/functions/request-customer-password-reset/index.ts', 'utf8');
assert.match(customerRecoveryFunction, /auth\.admin\.getUserById\(profile\.id\)/);
assert.match(customerRecoveryFunction, /roles\.has\("customer"\)/);
assert.match(customerRecoveryFunction, /\["admin", "kitchen", "delivery", "corporate"\]/);
assert.match(customerRecoveryFunction, /return accepted\(origin\)/);

const source = readFileSync('src/services/authService.ts', 'utf8')
  .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
  .replace(/export /g, '');

function serviceFor(auth, href, native = false, functions = { invoke: async () => ({ error: null }) }) {
  const location = { href };
  const history = { replaced: null, replaceState(_state, _title, path) { this.replaced = path; } };
  const result = vm.runInNewContext(
    stripTypeScriptTypes(source) + '\n;({ authService })',
    {
      URL,
      URLSearchParams,
      Error,
      console,
      window: { location, history },
      isSupabaseConfigured: () => true,
      getSupabaseClient: () => ({ auth, functions }),
      Capacitor: { isNativePlatform: () => native },
    },
  );
  return { ...result, history };
}

(async () => {
  let signupOptions;
  const unconfirmedSignup = serviceFor({ signUp: async options => {
    signupOptions = options;
    return { data: { user: { id: 'new-user' }, session: null }, error: null };
  } }, 'https://thalimitra.com/');
  const pendingSignup = await unconfirmedSignup.authService.signUp('new@example.com', 'StrongPassword1!', 'New Customer', '9876543210');
  assert.equal(pendingSignup.needsEmailConfirmation, true);
  assert.equal(signupOptions.options.emailRedirectTo, 'https://thalimitra.com/');
  const immediateSignup = serviceFor({ signUp: async () => ({ data: { user: { id: 'new-user' }, session: { access_token: 'token' } }, error: null }) }, 'https://thalimitra.com/');
  assert.equal((await immediateSignup.authService.signUp('new@example.com', 'StrongPassword1!', 'New Customer', '9876543210')).needsEmailConfirmation, false);

  let verificationPayload;
  let resendPayload;
  const emailOtp = serviceFor({
    verifyOtp: async payload => {
      verificationPayload = payload;
      return { data: { user: { id: 'new-user' }, session: { access_token: 'token' } }, error: null };
    },
    resend: async payload => { resendPayload = payload; return { error: null }; },
  }, 'https://thalimitra.com/');
  const verified = await emailOtp.authService.verifySignupEmailOtp(' NEW@example.com ', ' 123456 ');
  assert.equal(verified.user.id, 'new-user');
  assert.deepEqual(JSON.parse(JSON.stringify(verificationPayload)), { email: 'new@example.com', token: '123456', type: 'email' });
  assert.equal((await emailOtp.authService.resendSignupEmail(' NEW@example.com ')).error, null);
  assert.deepEqual(JSON.parse(JSON.stringify(resendPayload)), { type: 'signup', email: 'new@example.com' });
  const invalidOtp = serviceFor({ verifyOtp: async () => ({ data: { user: null, session: null }, error: new Error('invalid code') }) }, 'https://thalimitra.com/');
  assert.match((await invalidOtp.authService.verifySignupEmailOtp('new@example.com', '000000')).error.message, /invalid code/);

  let invoked;
  const customerReset = serviceFor({}, 'https://thalimitra.com/', false, { invoke: async (name, options) => { invoked = { name, options }; return { error: null }; } });
  assert.equal((await customerReset.authService.requestPasswordReset('customer@example.com', 'customer')).error, null);
  assert.deepEqual(JSON.parse(JSON.stringify(invoked)), { name: 'request-customer-password-reset', options: { body: { email: 'customer@example.com' } } });

  let operationsReset;
  const operations = serviceFor({ resetPasswordForEmail: async (email, options) => { operationsReset = { email, options }; return { error: null }; } }, 'https://ops.thalimitra.com/');
  assert.equal((await operations.authService.requestPasswordReset('staff@example.com', 'operations')).error, null);
  assert.deepEqual(JSON.parse(JSON.stringify(operationsReset)), { email: 'staff@example.com', options: { redirectTo: 'https://ops.thalimitra.com/reset-password' } });

  const active = serviceFor({ getSession: async () => ({ data: { session: { user: { id: 'u' } } }, error: null }) }, 'https://thalimitra.com/reset-password#access_token=secret');
  assert.equal((await active.authService.preparePasswordRecovery()).ready, true);
  assert.equal(active.history.replaced, '/reset-password');

  const code = serviceFor({
    getSession: async () => ({ data: { session: null }, error: null }),
    exchangeCodeForSession: async value => ({ data: { session: value === 'valid-code' ? { user: { id: 'u' } } : null }, error: null }),
  }, 'https://thalimitra.com/reset-password?code=valid-code');
  assert.equal((await code.authService.preparePasswordRecovery()).ready, true);

  const hash = serviceFor({
    getSession: async () => ({ data: { session: null }, error: null }),
    setSession: async tokens => ({ data: { session: tokens.access_token === 'access' ? { user: { id: 'u' } } : null }, error: null }),
  }, 'https://thalimitra.com/reset-password#access_token=access&refresh_token=refresh&type=recovery');
  assert.equal((await hash.authService.preparePasswordRecovery()).ready, true);

  let verifiedCode = '';
  const mfa = serviceFor({
    mfa: {
      getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: verifiedCode ? 'aal2' : 'aal1', nextLevel: 'aal2' }, error: null }),
      listFactors: async () => ({ data: { all: [{ id: 'totp-1', factor_type: 'totp', status: 'verified' }] }, error: null }),
      challengeAndVerify: async ({ factorId, code }) => {
        if (factorId === 'totp-1' && code === '123456') verifiedCode = code;
        return { error: verifiedCode ? null : new Error('invalid code') };
      },
    },
  }, 'https://thalimitra.com/reset-password');
  assert.deepEqual(
    JSON.parse(JSON.stringify(await mfa.authService.getPasswordRecoveryMfa())),
    { required: true, factorId: 'totp-1', error: null },
  );
  assert.equal((await mfa.authService.verifyPasswordRecoveryMfa('totp-1', '123456')).error, null);

  const missing = serviceFor({ getSession: async () => ({ data: { session: null }, error: null }) }, 'https://thalimitra.com/reset-password');
  const result = await missing.authService.preparePasswordRecovery();
  assert.equal(result.ready, false);
  assert.match(result.error.message, /invalid, expired, or already used/);

  let receivedTokens;
  const mobile = serviceFor({ setSession: async tokens => { receivedTokens = tokens; return { error: null }; } }, 'https://localhost/', true);
  assert.equal(await mobile.authService.consumeMobileRecoveryLink('https://thalimitra.com/reset-password#access_token=access&refresh_token=refresh&type=recovery'), true);
  assert.deepEqual(JSON.parse(JSON.stringify(receivedTokens)), { access_token: 'access', refresh_token: 'refresh' });
  assert.equal(mobile.history.replaced, '/reset-password');
  assert.equal(await mobile.authService.consumeMobileRecoveryLink('https://ops.thalimitra.com/reset-password?code=invalid'), false);

  const expiredMobile = serviceFor({ exchangeCodeForSession: async () => ({ error: new Error('expired') }) }, 'https://localhost/', true);
  assert.equal(await expiredMobile.authService.consumeMobileRecoveryLink('https://thalimitra.com/reset-password?code=expired'), true);
  assert.match(expiredMobile.history.replaced, /error_description=/);

  console.log('PASS: web and Android recovery callbacks, MFA elevation, and invalid-link handling');
})().catch(error => { console.error(error); process.exitCode = 1; });
