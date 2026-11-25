import React, { useEffect, useState } from 'react';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { ArrowLeft, CheckCircle2, FileUp, Landmark, Lock, Paperclip, ShieldCheck, Upload } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_COMPANY_SETTINGS } from '../context/DataContext';
import { db, handleFirestoreError, OperationType, uploadVisibylFile } from '../lib/firebase';
import { CompanySettings, OnboardingForm, UploadedAttachment } from '../types/visibyl';
import { makeDocId, SERVICE_QUESTIONS } from '../utils/formatters';

interface PublicOnboardingFormProps {
  formId: string;
  onExit: () => void;
}

export const PublicOnboardingForm: React.FC<PublicOnboardingFormProps> = ({ formId, onExit }) => {
  const { firebaseUser, signInWithGoogle, isActiveStaff } = useAuth();
  const [formDoc, setFormDoc] = useState<OnboardingForm | null>(null);
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedOk, setSubmittedOk] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [servicePurchased, setServicePurchased] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [requirementsDescription, setRequirementsDescription] = useState('');
  const [serviceSpecificAnswers, setServiceSpecificAnswers] = useState<Record<string, string>>({});
  const [logoUrl, setLogoUrl] = useState('');
  const [attachmentUrls, setAttachmentUrls] = useState<UploadedAttachment[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!firebaseUser) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [fSnap, sSnap] = await Promise.all([
          getDoc(doc(db, 'onboardingForms', formId)),
          getDoc(doc(db, 'settings', 'company')),
        ]);
        if (sSnap.exists()) {
          setSettings(sSnap.data() as CompanySettings);
        }
        if (!fSnap.exists()) {
          setError('Onboarding form was not found or your account does not have access to this private link.');
          setLoading(false);
          return;
        }
        const data = fSnap.data() as OnboardingForm;
        setFormDoc(data);
        setFullName(data.fullName || '');
        setBusinessName(data.businessName || '');
        setPhone(data.phone || '');
        setEmail(data.email || data.customerEmail || '');
        setBusinessAddress(data.businessAddress || '');
        setBusinessCategory(data.businessCategory || '');
        setServicePurchased(data.servicePurchased || DEFAULT_COMPANY_SETTINGS.services[0]);
        setBusinessDescription(data.businessDescription || '');
        setRequirementsDescription(data.requirementsDescription || '');
        setServiceSpecificAnswers(data.serviceSpecificAnswers || {});
        setLogoUrl(data.logoUrl || '');
        setAttachmentUrls(data.attachmentUrls || []);
        if (data.status !== 'Pending') {
          setSubmittedOk(true);
        }
      } catch (err) {
        setError(
          err instanceof Error && err.message.includes('permission')
            ? 'Access denied: please sign in using the exact email address registered for this onboarding link.'
            : 'Unable to load onboarding form.'
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [firebaseUser, formId]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setError(null);
    try {
      const res = await uploadVisibylFile(`logos/${formId}`, file);
      setLogoUrl(res.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logo upload failed.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleAttachmentsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (attachmentUrls.length + files.length > 15) {
      setError('Maximum 15 project files may be attached.');
      return;
    }
    setUploadingFiles(true);
    setError(null);
    try {
      const uploaded: UploadedAttachment[] = [];
      for (const file of files) {
        const res = await uploadVisibylFile(`onboarding/${formId}`, file);
        uploaded.push(res);
      }
      setAttachmentUrls((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File upload failed.');
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDoc || !firebaseUser) return;
    setSubmitting(true);
    setError(null);
    const now = new Date().toISOString();

    const updated: OnboardingForm = {
      ...formDoc,
      status: 'Submitted',
      fullName: fullName.trim(),
      businessName: businessName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      businessAddress: businessAddress.trim(),
      businessCategory: businessCategory.trim(),
      servicePurchased,
      businessDescription: businessDescription.trim(),
      requirementsDescription: requirementsDescription.trim(),
      serviceSpecificAnswers,
      logoUrl,
      attachmentUrls,
      submittedByUid: firebaseUser.uid,
      submittedAt: now,
      updatedAt: now,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'onboardingForms', formDoc.id), updated);

      const logId = makeDocId('LOG');
      batch.set(doc(db, 'activityLogs', logId), {
        id: logId,
        actorUid: firebaseUser.uid,
        actorName: fullName.trim() || firebaseUser.email || 'Customer',
        actorRole: isActiveStaff ? 'staff' : 'customer',
        action: 'submitted',
        entityType: 'onboardingForm',
        entityId: formDoc.id,
        summary: `Submitted onboarding form ${formDoc.formCode} for ${businessName.trim()}`,
        createdAt: now,
      });

      const notifId = makeDocId('NTF');
      batch.set(doc(db, 'notifications', notifId), {
        id: notifId,
        targetRole: 'admins',
        type: 'form_submitted',
        title: 'Customer Onboarding Form Submitted',
        message: `${businessName.trim()} submitted onboarding form ${formDoc.formCode} (${servicePurchased}).`,
        entityType: 'onboardingForm',
        entityId: formDoc.id,
        isRead: false,
        createdByUid: firebaseUser.uid,
        createdAt: now,
      });

      await batch.commit();
      setFormDoc(updated);
      setSubmittedOk(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `onboardingForms/${formDoc.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const dynamicQuestions = SERVICE_QUESTIONS[servicePurchased] || [
    { key: 'projectScope', label: 'Core Deliverables & Scope', placeholder: 'Describe key deliverables you expect from VISIBYL Technologies' },
    { key: 'targetAudience', label: 'Target Audience & Market', placeholder: 'Who are your ideal customers or users?' },
    { key: 'timelineGoals', label: 'Desired Launch Timeline', placeholder: 'Any upcoming launch dates or campaign milestones' },
  ];

  const isReadOnly = formDoc ? formDoc.status !== 'Pending' && !isActiveStaff : false;

  return (
    <div className="min-h-screen bg-slate-100 py-6 sm:py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={onExit}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg bg-white border border-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Visibyl Ops</span>
          </button>
          <span className="text-xs font-mono-tabular text-slate-500">Private Document · {formId}</span>
        </div>

        {/* Official VISIBYL Document Container */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {/* Official Corporate Header with Full Attached Logo */}
          <div className="bg-[#0144D8] px-6 sm:px-10 py-6 sm:py-8 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <BrandLogo variant="full" className="h-14 sm:h-16 w-auto" />
              <div className="sm:text-right text-xs text-blue-100 space-y-0.5">
                <p className="font-semibold text-white">{settings.companyName}</p>
                <p>{settings.companyEmail}</p>
                <p>{settings.companyPhone}</p>
              </div>
            </div>
          </div>

          {/* Document Title & Introduction */}
          <div className="px-6 sm:px-10 py-6 border-b border-slate-200 bg-slate-50/70">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Client Project Onboarding Brief</h1>
              {formDoc && (
                <span className="text-xs font-mono-tabular font-semibold text-[#0144D8]">
                  {formDoc.formCode} · {formDoc.status}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-3xl">
              Welcome to VISIBYL Technologies. Please complete this confidential onboarding brief carefully so our creative, strategy, and engineering teams can execute your project from unseen to unforgettable.
            </p>
          </div>

          <div className="p-6 sm:p-10">
            {!firebaseUser ? (
              <div className="text-center py-10 max-w-md mx-auto">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#0144D8] flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Verify Your Identity to Access Form</h2>
                <p className="mt-2 text-sm text-slate-600">
                  For client privacy, onboarding briefs are protected. Please sign in with your registered Google email to view and submit this document.
                </p>
                <button
                  onClick={() => signInWithGoogle()}
                  className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0144D8] text-white text-sm font-semibold hover:bg-[#0133A6] transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Sign in with Google</span>
                </button>
              </div>
            ) : loading ? (
              <div className="py-12 text-center text-sm text-slate-500">Loading private onboarding brief...</div>
            ) : error && !formDoc ? (
              <div className="p-5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">{error}</div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
                {error && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">{error}</div>
                )}

                {submittedOk && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Onboarding Brief Submitted</p>
                      <p className="text-xs mt-0.5 text-emerald-800">
                        Your information and uploaded materials are now linked to your VISIBYL client profile and assigned project team.
                      </p>
                    </div>
                  </div>
                )}

                {/* Section 1: Client & Business Profile */}
                <section className="space-y-4">
                  <h2 className="text-base font-bold text-[#0144D8] pb-2 border-b border-slate-200">
                    01. Client & Business Information
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name *</label>
                      <input
                        required
                        disabled={isReadOnly}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Business Name *</label>
                      <input
                        required
                        disabled={isReadOnly}
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone Number *</label>
                      <input
                        required
                        disabled={isReadOnly}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address *</label>
                      <input
                        required
                        type="email"
                        disabled={isReadOnly}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Business Category *</label>
                      <input
                        required
                        disabled={isReadOnly}
                        value={businessCategory}
                        onChange={(e) => setBusinessCategory(e.target.value)}
                        placeholder="e.g. Fashion Retail, Real Estate, Fintech, Healthcare"
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Service Purchased *</label>
                      <select
                        required
                        disabled={isReadOnly}
                        value={servicePurchased}
                        onChange={(e) => setServicePurchased(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm bg-white disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
                      >
                        {settings.services.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Business Address *</label>
                      <input
                        required
                        disabled={isReadOnly}
                        value={businessAddress}
                        onChange={(e) => setBusinessAddress(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
                      />
                    </div>
                  </div>
                </section>

                {/* Section 2: Project Scope & Service-Specific Questions */}
                <section className="space-y-4">
                  <h2 className="text-base font-bold text-[#0144D8] pb-2 border-b border-slate-200">
                    02. Business Overview & {servicePurchased} Details
                  </h2>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Detailed Business Description *
                    </label>
                    <textarea
                      required
                      rows={3}
                      disabled={isReadOnly}
                      value={businessDescription}
                      onChange={(e) => setBusinessDescription(e.target.value)}
                      placeholder="Describe what your business does, your products/services, and your unique value proposition..."
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Requirements & Project Expectations *
                    </label>
                    <textarea
                      required
                      rows={4}
                      disabled={isReadOnly}
                      value={requirementsDescription}
                      onChange={(e) => setRequirementsDescription(e.target.value)}
                      placeholder="Outline every feature, style preference, target outcome, or expectation you want delivered..."
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 pt-2">
                    {dynamicQuestions.map((q) => (
                      <div key={q.key}>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">{q.label}</label>
                        <input
                          disabled={isReadOnly}
                          value={serviceSpecificAnswers[q.key] || ''}
                          onChange={(e) =>
                            setServiceSpecificAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))
                          }
                          placeholder={q.placeholder}
                          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
                        />
                      </div>
                    ))}
                  </div>
                </section>

                {/* Section 3: Brand Logo & Project Materials */}
                <section className="space-y-4">
                  <h2 className="text-base font-bold text-[#0144D8] pb-2 border-b border-slate-200">
                    03. Brand Logo & Project Materials
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                      <p className="text-xs font-semibold text-slate-800">Business Logo Upload</p>
                      {logoUrl && (
                        <div className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-lg">
                          <img src={logoUrl} alt="Business logo" className="h-12 w-12 object-contain rounded" />
                          <a href={logoUrl} target="_blank" rel="noreferrer" className="text-xs text-[#0144D8] font-semibold underline truncate">
                            View uploaded logo
                          </a>
                        </div>
                      )}
                      {!isReadOnly && (
                        <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                          <Upload className="w-4 h-4 text-[#0144D8]" />
                          <span>{uploadingLogo ? 'Uploading...' : 'Upload Logo (PNG/SVG/JPG)'}</span>
                          <input type="file" accept=".png,.jpg,.jpeg,.webp,.svg" onChange={handleLogoUpload} className="hidden" />
                        </label>
                      )}
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                      <p className="text-xs font-semibold text-slate-800">Pictures, Documents & Reference Files</p>
                      {attachmentUrls.length > 0 && (
                        <ul className="space-y-1.5">
                          {attachmentUrls.map((att, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                              <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <a href={att.url} target="_blank" rel="noreferrer" className="text-[#0144D8] hover:underline truncate">
                                {att.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                      {!isReadOnly && (
                        <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                          <FileUp className="w-4 h-4 text-[#0144D8]" />
                          <span>{uploadingFiles ? 'Uploading files...' : 'Upload Project Materials'}</span>
                          <input type="file" multiple onChange={handleAttachmentsUpload} className="hidden" />
                        </label>
                      )}
                    </div>
                  </div>
                </section>

                {/* Permanent Company Bank Details — Payment Information Section */}
                <section className="rounded-xl border border-[#0144D8]/25 bg-[#F0F5FF] p-5 sm:p-6">
                  <div className="flex items-center gap-2.5 text-[#0144D8] mb-3">
                    <Landmark className="w-5 h-5" />
                    <h2 className="text-base font-bold">Payment Information</h2>
                  </div>
                  <p className="text-xs text-slate-600 mb-4">
                    All project deposits and milestone payments must be remitted strictly to the official VISIBYL Technologies corporate account below:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white border border-blue-100 rounded-xl p-4">
                    <div>
                      <p className="text-xs text-slate-500">Account Name</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">{settings.bankAccountName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Bank</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">{settings.bankName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Account Number</p>
                      <p className="text-base font-bold font-mono-tabular text-[#0144D8] mt-0.5">{settings.bankAccountNumber}</p>
                    </div>
                  </div>
                </section>

                {!isReadOnly && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={submitting || uploadingLogo || uploadingFiles}
                      className="px-7 py-3 rounded-xl bg-[#0144D8] hover:bg-[#0133A6] disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
                    >
                      {submitting ? 'Submitting Onboarding Brief...' : 'Submit Onboarding Brief'}
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>

          {/* Consistent Official Corporate Footer */}
          <footer className="px-6 sm:px-10 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
            <span>{settings.companyName} · {settings.tagline}</span>
            <span>{settings.companyAddress} · {settings.companyEmail}</span>
          </footer>
        </div>
      </div>
    </div>
  );
};
