import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useApp } from '../context/AppContext';
import { BRAND_CONFIG } from '../data/config';
import { MapPin, Mail, Send, CheckCircle2 } from 'lucide-react';
import { supportService, type SupportCategory, type SupportRequest } from '../services/supportService';

export const ContactPage: React.FC = () => {
  const { showToast, currentUser, setIsAuthModalOpen } = useApp();
  const [queryType, setQueryType] = useState<SupportCategory>('account_help');
  const [message, setMessage] = useState('');
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    let active = true;
    if (!currentUser) { setRequests([]); return; }
    void supportService.getMine().then(value => { if (active) setRequests(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [currentUser?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setIsAuthModalOpen(true);
      showToast('Sign in required', 'Sign in so the team can securely track and answer your request.', 'info');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const request = await supportService.create(queryType, message);
      const ticket = request.id.slice(0, 8).toUpperCase();
      setRequests(previous => [request, ...previous]);
      setSubmittedTicket(ticket);
      showToast('Support request saved', `Ticket ${ticket} is now in the admin queue.`, 'success');
    } catch (error) {
      showToast('Support unavailable', error instanceof Error ? error.message : 'Try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${isNative ? 'py-5' : 'py-12'} bg-white`}>
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isNative ? 'space-y-5' : 'space-y-12'}`}>
        {!isNative && <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#0D6E44] bg-emerald-50 px-3.5 py-1 rounded-full border border-emerald-200">
            Gandhinagar Kitchen & Support Hub
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-stone-900 mt-4 tracking-tight">
            Get in Touch with Thalimitra
          </h1>
          <p className="text-stone-600 text-base mt-3 leading-relaxed">
            Have questions about custom plans, corporate orders, or delivery timing in your sector? We’re always here to help.
          </p>
        </div>}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Info Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#FAF8F5] p-6 rounded-3xl border border-stone-200 space-y-4">
              <h3 className="font-bold text-lg text-stone-900">Direct Contact Details</h3>

              <div className="space-y-3 text-xs text-stone-700">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-stone-900">Current Service Area:</span>
                    <span>{BRAND_CONFIG.location}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-stone-900">Official Email:</span>
                    <span>{BRAND_CONFIG.email}</span>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Right Contact Form */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xl">
              {submittedTicket ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-stone-900">Message Sent Successfully!</h3>
                  <p className="text-xs text-stone-500 max-w-sm mx-auto">
                    Ticket {submittedTicket} is saved against {currentUser?.email}. Track updates by returning to this page.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h3 className="font-bold text-lg text-stone-900 mb-2">Send Us an Enquiry</h3>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
                    {currentUser ? <>Submitting from <strong>{currentUser.email}</strong>. Your account details are attached securely.</> : <><strong>Sign in required.</strong> We use your Thalimitra account so the request can be tracked and answered securely.</>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Enquiry Type</label>
                    <select
                      value={queryType}
                      onChange={(e) => setQueryType(e.target.value as SupportCategory)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                    >
                      <option value="account_help">Account or sign-in help</option>
                      <option value="order_help">Order help</option>
                      <option value="cancellation_help">Cancellation help</option>
                      <option value="delivery_help">Delivery help</option>
                      <option value="menu_question">Menu / dietary question</option>
                      <option value="corporate">Corporate / bulk catering</option>
                      <option value="other">Other question</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">Your Message / Requirements</label>
                    <textarea
                      rows={4}
                      required
                      minLength={10}
                      maxLength={2000}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us about your requirements, specific Gandhinagar sector, or meal questions..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || message.trim().length < 10}
                    className="w-full py-3.5 rounded-xl bg-[#107048] hover:bg-[#0A4E32] text-white text-xs font-bold shadow-md flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
                  >
                    <Send className="w-4 h-4" />
                    <span>{submitting ? 'Saving request…' : currentUser ? 'Send to Admin Support Queue' : 'Sign In & Continue'}</span>
                  </button>
                </form>
              )}
              {currentUser && requests.length > 0 && <div className="mt-6 border-t border-stone-100 pt-5">
                <h4 className="text-sm font-black text-stone-900">My recent requests</h4>
                <div className="mt-3 space-y-2">{requests.slice(0, 5).map(request => <div key={request.id} className="flex items-start justify-between gap-3 rounded-xl bg-stone-50 p-3 text-xs"><div><p className="font-bold text-stone-800">{request.category.replace(/_/g, ' ')}</p><p className="mt-1 line-clamp-2 text-stone-500">{request.message}</p></div><span className={`shrink-0 rounded-full px-2 py-1 font-bold ${request.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : request.status === 'in_progress' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-800'}`}>{request.status.replace('_', ' ')}</span></div>)}</div>
              </div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
