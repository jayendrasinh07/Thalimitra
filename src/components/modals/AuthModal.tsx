import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  Phone, 
  ArrowRight, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import { authService } from '../../services/authService';
import { getPasswordPolicyError, PASSWORD_REQUIREMENTS } from '../../utils/passwordPolicy';

export const AuthModal: React.FC = () => {
  const { 
    isAuthModalOpen, 
    setIsAuthModalOpen, 
    signInUser, 
    signUpUser, 
    verifySignUpOtp,
    showToast,
  } = useApp();
  const isKitchenSignIn = (import.meta as any).env?.VITE_APP_TARGET === 'ops';
  const emailOtpEnabled = !isKitchenSignIn && (import.meta as any).env?.VITE_CUSTOMER_EMAIL_OTP_ENABLED === 'true';

  const [mode, setMode] = useState<'signin' | 'signup' | 'verify'>('signin');
  const isSignIn = isKitchenSignIn || mode === 'signin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      if (mode === 'verify' && emailOtpEnabled) {
        if (!/^\d{6}$/.test(otp)) {
          setErrorMessage('Enter the 6-digit code from your email.');
          return;
        }
        const { error } = await verifySignUpOtp(email, otp);
        if (error) {
          setErrorMessage(error.message || 'This code could not be verified. Check it and try again.');
          return;
        }
        setOtp('');
        showToast('Email verified', 'Your Thalimitra account is ready.', 'success');
        setIsAuthModalOpen(false);
      } else if (isSignIn) {
        const { error } = await signInUser(email, password);
        if (error) {
          setErrorMessage(error.message || 'Invalid email or password.');
          return;
        }
        showToast('Welcome Back!', 'You have successfully signed in to Thalimitra.', 'success');
        setIsAuthModalOpen(false);
      } else {
        if (!fullName.trim()) {
          setErrorMessage('Please enter your full name.');
          setLoading(false);
          return;
        }
        if (!phone.trim() || phone.trim().length < 10) {
          setErrorMessage('Please enter a valid 10-digit mobile number.');
          setLoading(false);
          return;
        }
        const passwordError = getPasswordPolicyError(password);
        if (passwordError) {
          setErrorMessage(passwordError);
          setLoading(false);
          return;
        }

        const { error, needsEmailConfirmation } = await signUpUser(email, password, fullName, phone);
        if (error) {
          setErrorMessage(error.message || 'Could not complete registration.');
          return;
        }
        if (needsEmailConfirmation) {
          setPassword('');
          setMode(emailOtpEnabled ? 'verify' : 'signin');
          setInfoMessage(emailOtpEnabled
            ? 'Enter the 6-digit code sent to your email. Check Spam or Promotions if you cannot find it.'
            : 'Check your email for the Thalimitra confirmation link. Open it, then return here and sign in. There is no code to enter in the app. If the email is missing, check Spam or Promotions.');
          return;
        }
        showToast('Account Created!', 'Welcome to Thalimitra Gandhinagar. Your profile is ready.', 'success');
        setIsAuthModalOpen(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendSignupEmail = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      const { error } = await authService.resendSignupEmail(email);
      if (error) {
        setErrorMessage(error.message || 'Could not resend the code. Please try again later.');
        return;
      }
      setInfoMessage('A new verification email was requested. Check your inbox and Spam or Promotions.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage('Enter your email address first.');
      return;
    }

    setLoading(true);
    const { error } = await authService.requestPasswordReset(normalizedEmail, isKitchenSignIn ? 'operations' : 'customer');
    setLoading(false);
    if (error) {
      setErrorMessage(error.message || 'Could not send the reset link. Please try again.');
      return;
    }
    setInfoMessage(isKitchenSignIn
      ? 'If this email has authorized Operations access, a secure reset link has been sent.'
      : 'If this email was registered as a customer, a secure reset link has been sent.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-sm animate-fadeIn select-none">
      <div className="bg-[#FAF8F5] text-stone-900 w-full max-w-md rounded-3xl shadow-2xl border border-stone-200 overflow-hidden relative">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-[#0D6E44] to-[#08482C] text-white px-6 py-6 relative">
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-1 text-amber-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Thalimitra Gandhinagar</span>
          </div>

          <h3 className="text-xl font-black tracking-tight">
             {isKitchenSignIn ? 'Kitchen sign in' : mode === 'verify' ? 'Verify your email' : mode === 'signin' ? 'Sign in to your account' : 'Create your Thalimitra account'}
          </h3>
          <p className="text-xs text-stone-200 mt-1">
            {isKitchenSignIn
              ? 'Access menu planning and live order operations.'
               : mode === 'verify'
               ? 'One more step to secure your new account.'
               : mode === 'signin'
              ? 'Access your saved addresses and orders.'
              : 'Daily fresh, hygienic home-style meals delivered to your doorstep.'}
          </p>

          {/* Mode Switcher Tabs */}
           {!isKitchenSignIn && mode !== 'verify' && <div className="flex bg-black/20 p-1 rounded-xl mt-4">
            <button
              type="button"
              onClick={() => { setMode('signin'); setErrorMessage(null); setInfoMessage(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                mode === 'signin' ? 'bg-white text-[#0D6E44] shadow-xs' : 'text-stone-200 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setErrorMessage(null); setInfoMessage(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                mode === 'signup' ? 'bg-white text-[#0D6E44] shadow-xs' : 'text-stone-200 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-medium">{errorMessage}</div>
            </div>
          )}

          {infoMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5" role="status">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="font-medium">{infoMessage}</div>
            </div>
          )}

          {/* Sign Up Details */}
           {mode === 'signup' && !isKitchenSignIn && (
            <>
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Customer name"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-sm text-stone-900 focus:ring-2 focus:ring-[#0D6E44] focus:border-transparent outline-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Mobile Number (For Delivery Partner)</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-sm text-stone-900 focus:ring-2 focus:ring-[#0D6E44] focus:border-transparent outline-none font-medium"
                  />
                </div>
              </div>

            </>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
               readOnly={mode === 'verify'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-sm text-stone-900 focus:ring-2 focus:ring-[#0D6E44] focus:border-transparent outline-none font-medium"
              />
            </div>
          </div>

           {/* Password */}
           {mode !== 'verify' && <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-stone-700">Password</label>
              {isSignIn && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-[11px] text-[#0D6E44] hover:underline font-semibold cursor-pointer disabled:opacity-60"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={isSignIn ? undefined : 12}
                autoComplete={isSignIn ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white border border-stone-300 text-sm text-stone-900 focus:ring-2 focus:ring-[#0D6E44] focus:border-transparent outline-none font-medium"
              />
            </div>
            {!isSignIn && <p className="mt-1 text-[11px] text-stone-500">{PASSWORD_REQUIREMENTS}</p>}
          </div>}

          {mode === 'verify' && emailOtpEnabled && (
            <div>
              <label htmlFor="signup-email-otp" className="block text-xs font-bold text-stone-700 mb-1">6-digit email code</label>
              <input
                id="signup-email-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-3 rounded-xl bg-white border border-stone-300 text-center tracking-[0.4em] text-lg font-bold text-stone-900 focus:ring-2 focus:ring-[#0D6E44] focus:border-transparent outline-none"
              />
              <button type="button" onClick={handleResendSignupEmail} disabled={loading} className="mt-2 text-xs font-semibold text-[#0D6E44] hover:underline disabled:opacity-60">
                Resend verification email
              </button>
            </div>
          )}

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-[#0D6E44] hover:bg-[#08482C] text-white text-sm font-black shadow-lg shadow-emerald-950/15 hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                 <span>{mode === 'verify' ? 'Verifying...' : isSignIn ? 'Signing in...' : 'Creating Account...'}</span>
              </>
            ) : (
              <>
                 <span>{mode === 'verify' ? 'Verify email' : isSignIn ? 'Sign In' : 'Complete Registration'}</span>
                <ArrowRight className="w-4 h-4 text-amber-300" />
              </>
            )}
          </button>

           {mode === 'signin' && emailOtpEnabled && (
             <button type="button" onClick={() => {
               if (!email.trim()) { setErrorMessage('Enter your email address first.'); return; }
               setMode('verify');
               setErrorMessage(null);
               setInfoMessage('Enter the 6-digit code from your Thalimitra verification email.');
             }} className="w-full text-xs font-semibold text-[#0D6E44] hover:underline">
               Have a verification code?
             </button>
           )}

           {mode === 'verify' && emailOtpEnabled && (
             <button type="button" onClick={() => { setMode('signin'); setErrorMessage(null); setInfoMessage(null); }} className="w-full text-xs font-semibold text-stone-600 hover:text-[#0D6E44]">
               Already verified? Sign in
             </button>
           )}

          {/* Privacy & Trust Badge */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-400 pt-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isKitchenSignIn ? 'Protected staff access • MFA verification required' : 'Secure sign-in • Your details stay private'}</span>
          </div>

          {!isSupabaseConfigured() && (
            <div className="text-center text-[10px] text-amber-700 bg-amber-50 rounded-xl p-2 border border-amber-200">
              ⚡ <strong>Demo Mode Active</strong>: Instant login enabled for local preview. Connect Supabase keys in `.env` for live cloud database sync.
            </div>
          )}

        </form>

      </div>
    </div>
  );
};
