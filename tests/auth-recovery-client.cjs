const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = readFileSync('src/services/authService.ts', 'utf8')
  .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
  .replace(/export /g, '');

function serviceFor(auth, href, native = false) {
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
      getSupabaseClient: () => ({ auth }),
      Capacitor: { isNativePlatform: () => native },
    },
  );
  return { ...result, history };
}

(async () => {
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
