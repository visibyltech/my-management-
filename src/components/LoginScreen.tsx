import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, FileText, Lock, LogOut, ShieldAlert, UserCheck, Mail, KeyRound } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { DEFAULT_DEPARTMENTS, formatDate, formatNaira } from '../utils/formatters';

interface LoginScreenProps {
  onOpenOnboardingForm?: (formId: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onOpenOnboardingForm }) => {
  const {
    firebaseUser,
    staffProfile,
    authError,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    requestStaffAccess,
  } = useAuth();
  const { customers, onboardingForms, invoices, payments, settings } = useData();

  const [signingIn, setSigningIn] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [showStaffRequest, setShowStaffRequest] = useState(false);
  const [reqSubmitted, setReqSubmitted] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    fullName: firebaseUser?.displayName || '',
    phone: '',
    department: DEFAULT_DEPARTMENTS[0],
    position: '',
    role: 'sales' as 'sales' | 'developer' | 'support',
    bankName: '',
    bankAccountNumber: '',
    bankAccountName: '',
  });

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigningIn(true);
    setAuthMessage(null);
    try {
      if (authMode === 'signup') {
        await signUpWithEmail(email.trim(), password);
        setAuthMessage('Account created. Check your email for a verification link, then sign in.');
        setAuthMode('signin');
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (err) {
      setAuthMessage(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setAuthMessage(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthMessage(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleStaffRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setReqError(null);
    try {
      await requestStaffAccess({
        ...formState,
        fullName: formState.fullName || firebaseUser?.displayName || 'Staff Member',
      });
      setReqSubmitted(true);
      setShowStaffRequest(false);
    } catch (err) {
      setReqError(err instanceof Error ? err.message : 'Unable to submit staff request.');
    }
  };

  // Signed in, waiting on status or Customer Portal
  if (firebaseUser) {
    const status = staffProfile?.employmentStatus;

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-[#0144D8] text-white border-b border-[#0133A6]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
            <BrandLogo variant="full" className="h-10 sm:h-12 w-auto" />
            <div className="flex items-center gap-3">
              <PWAInstallButton compact />
              <button
                onClick={signOut}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors whitespace-nowrap"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
          {/* Account Status Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#0144D8]">Signed in as {firebaseUser.email}</p>
                <h1 className="mt-1 text-xl font-bold text-slate-900">
                  {staffProfile ? `Staff Account — ${staffProfile.staffCode}` : 'VISIBYL Workspace & Client Portal'}
                </h1>
              </div>
              {staffProfile && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold">
                  {status === 'pending' && <Clock className="w-4 h-4 text-amber-600" />}
                  {status === 'suspended' && <ShieldAlert className="w-4 h-4 text-red-600" />}
                  {status === 'revoked' && <Lock className="w-4 h-4 text-red-700" />}
                  <span className="capitalize">Status: {status}</span>
                </div>
              )}
            </div>

            {status === 'pending' && (
              <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                Your staff registration request ({staffProfile?.department} · {staffProfile?.position}) has been received and is awaiting Super Admin approval.
              </div>
            )}
            {(status === 'suspended' || status === 'revoked') && (
              <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-900">
                Your staff account access is currently <strong>{status}</strong>. Please contact the Super Administrator for reactivation.
              </div>
            )}

            {!staffProfile && !reqSubmitted && (
              <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-5 border-t border-slate-100">
                <p className="text-sm text-slate-600">
                  If you are a VISIBYL employee whose account has not been pre-invited, you can submit a staff access request for Super Admin review.
                </p>
                <button
                  onClick={() => setShowStaffRequest(!showStaffRequest)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6] transition-colors whitespace-nowrap shrink-0"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{showStaffRequest ? 'Hide Staff Form' : 'Request Staff Access'}</span>
                </button>
              </div>
            )}

            {reqSubmitted && (
              <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Staff registration submitted. An administrator will approve your access shortly.</span>
              </div>
            )}

            {showStaffRequest && !staffProfile && (
              <form onSubmit={handleStaffRequest} className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {reqError && (
                  <div className="sm:col-span-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {reqError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    required
                    value={formState.fullName}
                    onChange={(e) => setFormState({ ...formState, fullName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    required
                    value={formState.phone}
                    onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                    placeholder="+234..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={formState.department}
                    onChange={(e) => setFormState({ ...formState, department: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
                  >
                    {settings.departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role Requested</label>
                  <select
                    value={formState.role}
                    onChange={(e) => setFormState({ ...formState, role: e.target.value as 'sales' | 'developer' | 'support' })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
                  >
                    <option value="sales">Sales Representative</option>
                    <option value="developer">Developer</option>
                    <option value="support">Customer Support</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Position / Job Title</label>
                  <input
                    required
                    value={formState.position}
                    onChange={(e) => setFormState({ ...formState, position: e.target.value })}
                    placeholder="e.g. Full-Stack Developer"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payout Bank Name (Optional)</label>
                  <input
                    value={formState.bankName}
                    onChange={(e) => setFormState({ ...formState, bankName: e.target.value })}
                    placeholder="e.g. Kuda Bank"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Account Number (Optional)</label>
                  <input
                    value={formState.bankAccountNumber}
                    onChange={(e) => setFormState({ ...formState, bankAccountNumber: e.target.value })}
                    placeholder="10 digits"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Account Name (Optional)</label>
                  <input
                    value={formState.bankAccountName}
                    onChange={(e) => setFormState({ ...formState, bankAccountName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-lg bg-[#0144D8] text-white text-sm font-semibold hover:bg-[#0133A6] transition-colors"
                  >
                    Submit Staff Request
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Customer Private Records Portal (only shows records matching verified customer email) */}
          {(customers.length > 0 || onboardingForms.length > 0 || invoices.length > 0) && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Your Private Client Portal</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Viewing onboarding forms, invoices, and verified payments associated with {firebaseUser.email}.
                </p>
              </div>

              {onboardingForms.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">Onboarding Forms</h3>
                  <div className="space-y-2.5">
                    {onboardingForms.map((form) => (
                      <div
                        key={form.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
                      >
                        <div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono-tabular font-semibold text-slate-800">{form.formCode}</span>
                            <span>·</span>
                            <span>{form.servicePurchased}</span>
                            <span>·</span>
                            <span className={form.status === 'Pending' ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                              {form.status}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900 mt-1">{form.businessName || form.fullName}</p>
                        </div>
                        {onOpenOnboardingForm && (
                          <button
                            onClick={() => onOpenOnboardingForm(form.id)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6] transition-colors whitespace-nowrap"
                          >
                            <FileText className="w-4 h-4" />
                            <span>{form.status === 'Pending' ? 'Complete Form' : 'View Submission'}</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {invoices.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">Your Invoices</h3>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {invoices.map((inv) => (
                      <div key={inv.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 font-mono-tabular">{inv.invoiceNumber}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Issued {formatDate(inv.issueDate)} · Due {formatDate(inv.dueDate)} · {inv.status}
                          </p>
                        </div>
                        <div className="text-right font-mono-tabular">
                          <p className="text-sm font-bold text-slate-900">{formatNaira(inv.totalAmount)}</p>
                          <p className="text-xs text-slate-500">Balance: {formatNaira(inv.outstandingBalance)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {payments.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">Payment History</h3>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {payments.map((p) => (
                      <div key={p.id} className="p-4 flex items-center justify-between bg-white">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 font-mono-tabular">{p.receiptNumber}</p>
                          <p className="text-xs text-slate-500">
                            {formatDate(p.paymentDate)} · Ref: {p.transactionReference} · {p.verificationStatus}
                          </p>
                        </div>
                        <p className="text-sm font-bold font-mono-tabular text-slate-900">{formatNaira(p.amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  // Unauthenticated Sign-In Screen
  return (
    <div className="min-h-screen bg-[#0144D8] flex flex-col lg:flex-row">
      {/* Compact Brand Header */}
      <div className="lg:w-7/12 p-6 sm:p-10 lg:p-14 flex flex-col justify-center text-white">
        <div className="max-w-xl">
          <BrandLogo variant="full" className="h-12 sm:h-14 w-auto" />
          <h1 className="mt-8 text-3xl sm:text-5xl font-bold leading-tight text-balance">
            VISIBYL Technologies<br />Business Management System
          </h1>
        </div>
      </div>

      {/* Right Sign-In Panel */}
      <div className="lg:w-5/12 bg-white rounded-t-3xl lg:rounded-none lg:rounded-l-3xl p-6 sm:p-10 lg:p-14 flex flex-col justify-center">
        <div className="max-w-md w-full mx-auto">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#0144D8] p-1.5 mb-6">
            <BrandLogo variant="symbol" className="w-full h-full" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            {authMode === 'signin' ? 'Sign in to Visibyl Ops' : 'Create your staff account'}
          </h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            {authMode === 'signin' ? 'Enter your company email and password to continue.' : 'Create an account using your email address and a secure password.'}
          </p>

          {(authError || authMessage) && (
            <div className={`mt-5 p-3.5 rounded-xl border text-xs ${authMessage ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {authMessage || authError}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="email" required autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-300 pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0144D8]" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="password" required minLength={6} autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters"
                  className="w-full rounded-xl border border-slate-300 pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0144D8]" />
              </div>
            </div>
            <button type="submit" disabled={signingIn}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#0144D8] hover:bg-[#0133A6] disabled:opacity-60 text-white text-sm font-semibold transition-colors">
              <span>{signingIn ? 'Please wait...' : authMode === 'signin' ? 'Sign In' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="relative my-5 flex items-center">
            <div className="flex-1 border-t border-slate-200" />
            <span className="px-3 text-xs font-medium text-slate-400">OR</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 text-sm font-semibold transition-colors"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-sm font-bold text-[#4285F4]">G</span>
            <span>{signingIn ? 'Please wait...' : 'Continue with Google'}</span>
          </button>

          <div className="mt-5 text-center text-sm text-slate-600">
            {authMode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
            <button type="button" onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setAuthMessage(null); }}
              className="ml-1.5 font-semibold text-[#0144D8] hover:underline">
              {authMode === 'signin' ? 'Create account' : 'Sign in'}
            </button>
          </div>
          <div className="mt-6 flex justify-center"><PWAInstallButton compact /></div>
        </div>
      </div>
    </div>
  );
};
