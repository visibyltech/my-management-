import React, { useState } from 'react';
import { Check, CheckCircle2, Copy, ExternalLink, FileCheck2, Mail, MessageCircle, Plus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { OnboardingForm } from '../types/visibyl';
import { formatDate } from '../utils/formatters';

interface OnboardingGeneratorViewProps {
  onOpenForm: (formId: string) => void;
}

export const OnboardingGeneratorView: React.FC<OnboardingGeneratorViewProps> = ({ onOpenForm }) => {
  const { isAdmin, isDeveloper, isSupport } = useAuth();
  const {
    customers,
    projects,
    onboardingForms,
    staffPublic,
    settings,
    createOnboardingForm,
    markOnboardingReviewed,
  } = useData();

  const [showModal, setShowModal] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [developerUid, setDeveloperUid] = useState('');
  const [servicePurchased, setServicePurchased] = useState(settings.services[0] || '');
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewingForm, setViewingForm] = useState<OnboardingForm | null>(null);

  const developers = staffPublic.filter(
    (s) => s.employmentStatus === 'active' && ['developer', 'admin', 'super_admin'].includes(s.role)
  );

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;
    setSaving(true);
    try {
      const created = await createOnboardingForm({
        customer,
        servicePurchased,
        projectId: projectId || undefined,
        developerUid: developerUid || undefined,
      });
      setShowModal(false);
      setCustomerId('');
      setProjectId('');
      setDeveloperUid('');
      setViewingForm(created);
    } finally {
      setSaving(false);
    }
  };

  const getPrivateLink = (formId: string) => `${window.location.origin}/?onboard=${formId}`;

  const copyLink = async (formId: string) => {
    await navigator.clipboard?.writeText(getPrivateLink(formId)).catch(() => {});
    setCopiedId(formId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const shareWhatsApp = (f: OnboardingForm) => {
    const link = getPrivateLink(f.id);
    const msg = encodeURIComponent(
      `Hello ${f.fullName || f.businessName || 'Client'}, please complete your private VISIBYL Technologies onboarding brief (${f.formCode}) for ${f.servicePurchased} using this link:\n${link}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

  const shareEmail = (f: OnboardingForm) => {
    const link = getPrivateLink(f.id);
    const subject = encodeURIComponent(`VISIBYL Technologies Onboarding Brief (${f.formCode})`);
    const body = encodeURIComponent(
      `Hello ${f.fullName || ''},\n\nWelcome to VISIBYL Technologies ("From unseen to unforgettable.").\n\nPlease complete your project onboarding brief for ${f.servicePurchased} at your private link below:\n${link}\n\nThank you,\nVISIBYL Technologies`
    );
    window.location.href = `mailto:${f.customerEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Customer Onboarding Forms</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Generate private branded onboarding links, collect requirements & assets, and sync directly to project teams.
          </p>
        </div>
        {!isDeveloper && (
          <button
            onClick={() => {
              setCustomerId(customers[0]?.id || '');
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6] whitespace-nowrap self-start"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Onboarding Link</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Forms List */}
        <div className={`${viewingForm ? 'lg:col-span-6' : 'lg:col-span-12'} bg-white border border-slate-200 rounded-xl overflow-hidden`}>
          {onboardingForms.length === 0 ? (
            <div className="p-10 text-center">
              <FileCheck2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No onboarding forms yet</p>
              <p className="text-xs text-slate-500 mt-1">Generate a private onboarding form to share with a registered customer.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {onboardingForms.map((f) => (
                <div key={f.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono-tabular">
                      <span className="font-semibold text-[#0144D8]">{f.formCode}</span>
                      <span>·</span>
                      <span
                        className={`font-semibold ${
                          f.status === 'Pending'
                            ? 'text-amber-700'
                            : f.status === 'Submitted'
                              ? 'text-[#0144D8]'
                              : 'text-emerald-700'
                        }`}
                      >
                        {f.status}
                      </span>
                      <span>·</span>
                      <span>{formatDate(f.createdAt)}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 mt-1 truncate">
                      {f.businessName || f.fullName || f.customerEmail}
                    </p>
                    <p className="text-xs text-slate-600 truncate">
                      {f.servicePurchased} · {f.customerEmail}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => copyLink(f.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      {copiedId === f.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === f.id ? 'Copied' : 'Copy Link'}</span>
                    </button>
                    <button
                      onClick={() => onOpenForm(f.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6]"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Document</span>
                    </button>
                    <button
                      onClick={() => setViewingForm(f)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submission Inspector */}
        {viewingForm && (
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <p className="text-xs font-mono-tabular font-semibold text-[#0144D8]">
                  {viewingForm.formCode} · {viewingForm.status}
                </p>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {viewingForm.businessName || viewingForm.fullName}
                </h3>
                <p className="text-xs text-slate-500">{viewingForm.servicePurchased}</p>
              </div>
              <button onClick={() => setViewingForm(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => shareWhatsApp(viewingForm)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Share via WhatsApp</span>
              </button>
              <button
                onClick={() => shareEmail(viewingForm)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-800 text-xs font-semibold hover:bg-slate-50"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Share via Email</span>
              </button>
              {(isAdmin || isSupport) && viewingForm.status === 'Submitted' && (
                <button
                  onClick={() => markOnboardingReviewed(viewingForm.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6]"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark Reviewed</span>
                </button>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <p className="font-bold text-slate-700">Client Contact</p>
                <p className="text-slate-600 mt-0.5">
                  {viewingForm.fullName} · {viewingForm.phone} · {viewingForm.email || viewingForm.customerEmail}
                </p>
                <p className="text-slate-500">{viewingForm.businessAddress}</p>
              </div>

              {viewingForm.businessDescription && (
                <div>
                  <p className="font-bold text-slate-700">Business Description</p>
                  <p className="text-slate-600 mt-0.5 whitespace-pre-line">{viewingForm.businessDescription}</p>
                </div>
              )}

              {viewingForm.requirementsDescription && (
                <div>
                  <p className="font-bold text-slate-700">Requirements & Project Expectations</p>
                  <p className="text-slate-600 mt-0.5 whitespace-pre-line">{viewingForm.requirementsDescription}</p>
                </div>
              )}

              {viewingForm.serviceSpecificAnswers &&
                Object.keys(viewingForm.serviceSpecificAnswers).length > 0 && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <p className="font-bold text-slate-800">Service-Specific Answers</p>
                    {Object.entries(viewingForm.serviceSpecificAnswers).map(([k, v]) => (
                      <div key={k}>
                        <p className="text-[11px] font-semibold text-slate-500 capitalize">{k}</p>
                        <p className="text-slate-800">{v || '—'}</p>
                      </div>
                    ))}
                  </div>
                )}

              {(viewingForm.logoUrl || (viewingForm.attachmentUrls && viewingForm.attachmentUrls.length > 0)) && (
                <div className="space-y-2 pt-2">
                  <p className="font-bold text-slate-700">Uploaded Logo & Project Materials</p>
                  {viewingForm.logoUrl && (
                    <a
                      href={viewingForm.logoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-[#0144D8] font-semibold underline"
                    >
                      View Uploaded Business Logo
                    </a>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {viewingForm.attachmentUrls?.map((att, idx) => (
                      <a
                        key={idx}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:text-[#0144D8]"
                      >
                        {att.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Generate Onboarding Link Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Generate Private Onboarding Link</h3>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleGenerate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer *</label>
                <select
                  required
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.businessName} ({c.customerCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Service Purchased *</label>
                <select
                  value={servicePurchased}
                  onChange={(e) => setServicePurchased(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  {settings.services.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Link to Project (Optional)</label>
                <select
                  value={projectId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setProjectId(pid);
                    const p = projects.find((pr) => pr.id === pid);
                    if (p?.developerUid) setDeveloperUid(p.developerUid);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">No project linked yet</option>
                  {projects
                    .filter((p) => !customerId || p.customerId === customerId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} — {p.title}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notify / Assign Developer (Optional)</label>
                <select
                  value={developerUid}
                  onChange={(e) => setDeveloperUid(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">Assign later</option>
                  {developers.map((d) => (
                    <option key={d.uid} value={d.uid}>{d.fullName}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6]"
                >
                  {saving ? 'Generating...' : 'Generate Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
