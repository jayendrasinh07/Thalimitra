import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { authService } from '../services/authService';
import { getPasswordPolicyError, PASSWORD_REQUIREMENTS } from '../utils/passwordPolicy';

export const PasswordRecoveryPage: React.FC = () => {
  const { setActiveTab, setIsAuthModalOpen, showToast } = useApp();
  const isOpsBuild = (import.meta as any).env?.VITE_APP_TARGET === 'ops';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [recoveryState, setRecoveryState] = useState<'checking' | 'mfa' | 'ready' | 'invalid'>('checking');
  const [factorId, setFactorId] = useState('');
  const [securityCode, setSecurityCode] = useState('');

  const returnToSignIn = () => {
    setActiveTab(isOpsBuild ? 'kitchen_dashboard' : 'home');
    if (!isOpsBuild) setIsAuthModalOpen(true);
  };

  useEffect(() => {
    let active = true;
    void authService.preparePasswordRecovery().then(async ({ ready, error }) => {
      if (!active) return;
      if (!ready) {
        setRecoveryState('invalid');
        setErrorMessage(error?.message || null);
        return;
      }
      const mfa = await authService.getPasswordRecoveryMfa();
      if (!active) return;
      if (mfa.error) {
        setRecoveryState('invalid');
        setErrorMessage(mfa.error.message);
      } else if (mfa.required && mfa.factorId) {
        setFactorId(mfa.factorId);
        setRecoveryState('mfa');
      } else {
        setRecoveryState('ready');
      }
    });
    return () => { active = false; };
  }, []);

  const handleMfa = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(securityCode)) {
      setErrorMessage('Enter the current 6-digit code from your authenticator app.');
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    const { error } = await authService.verifyPasswordRecoveryMfa(factorId, securityCode);
    setLoading(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setSecurityCode('');
    setRecoveryState('ready');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    const passwordError = getPasswordPolicyError(password);
    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }
    if (password !== confirmation) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await authService.updatePassword(password);
    setLoading(false);
    if (error) {
      setErrorMessage(error.message || 'This reset link is invalid or expired. Request a new one.');
      return;
    }
    setComplete(true);
    showToast('Password Updated', 'Your new password is active.', 'success');
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-7 shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-[#0D6E44]">
          {complete ? <CheckCircle2 className="h-6 w-6" /> : <LockKeyhole className="h-6 w-6" />}
        </div>
        <h1 className="mt-4 text-center text-2xl font-black text-stone-900">
          {complete ? 'Password updated' : 'Create a new password'}
        </h1>
        <p className="mt-2 text-center text-sm text-stone-600">
          {complete
            ? isOpsBuild ? 'You can now return to the Operations workspace.' : 'You can now sign in to your Thalimitra account.'
            : 'Choose a secure password for your Thalimitra account.'}
        </p>

        {complete ? (
          <button
            type="button"
            onClick={returnToSignIn}
            className="mt-6 w-full rounded-2xl bg-[#0D6E44] px-5 py-3 text-sm font-black text-white hover:bg-[#08482C]"
          >
            {isOpsBuild ? 'Sign in to Operations' : 'Sign in'}
          </button>
        ) : recoveryState === 'checking' ? (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-stone-100 p-4 text-sm font-bold text-stone-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking your secure reset link…
          </div>
        ) : recoveryState === 'mfa' ? (
          <form onSubmit={handleMfa} className="mt-6 space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-950">
              <ShieldCheck className="h-5 w-5 shrink-0 text-[#0D6E44]" />
              Verify account security before changing the password.
            </div>
            {errorMessage && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800">{errorMessage}</p>}
            <label className="block text-xs font-bold text-stone-700">
              6-digit authenticator code
              <input
                value={securityCode}
                onChange={(event) => setSecurityCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                required
                className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 text-center text-xl font-black tracking-[0.35em] outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </label>
            <button type="submit" disabled={loading || securityCode.length !== 6} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0D6E44] px-5 py-3 text-sm font-black text-white disabled:opacity-60">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Verify security code
            </button>
          </form>
        ) : recoveryState === 'invalid' ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={returnToSignIn}
              className="w-full rounded-2xl bg-[#0D6E44] px-5 py-3 text-sm font-black text-white hover:bg-[#08482C]"
            >
              Request a new reset link
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {errorMessage && (
              <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}
            <label className="block text-xs font-bold text-stone-700">
              New password
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#0D6E44]"
              />
              <span className="mt-1 block font-normal text-stone-500">{PASSWORD_REQUIREMENTS}</span>
            </label>
            <label className="block text-xs font-bold text-stone-700">
              Confirm new password
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#0D6E44]"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0D6E44] px-5 py-3 text-sm font-black text-white hover:bg-[#08482C] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Update password
            </button>
            <button
              type="button"
              onClick={returnToSignIn}
              className="w-full text-xs font-bold text-stone-500 hover:text-stone-800"
            >
              {isOpsBuild ? 'Back to Operations sign in' : 'Back to sign in'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
};
