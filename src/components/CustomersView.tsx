import React, { useMemo, useState } from 'react';
import {
  Building2,
  ExternalLink,
  FileCheck2,
  FileSpreadsheet,
  Plus,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Customer, NavSection } from '../types/visibyl';
import { formatDate, formatNaira } from '../utils/formatters';

interface CustomersViewProps {
  initialSelectedId?: string | null;
  onNavigate?: (section: NavSection) => void;
  onOpenOnboarding?: (formId: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  initialSelectedId,
  onNavigate,
  onOpenOnboarding,
}) => {
  const { firebaseUser, staffProfile, isAdmin } = useAuth();
  const {
    customers,
    projects,
    projectFinancials,
    invoices,
    payments,
    onboardingForms,
    staffPublic,
    settings,
    createCustomer,
    createOnboardingForm,
  } = useData();

  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(() =>
    initialSelectedId ? customers.find((c) => c.id === initialSelectedId) || null : null
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickMsg, setQuickMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: '',
    businessName: '',
    phone: '',
    email: '',
    businessAddress: '',
    businessCategory: '',
    salesRepUid: firebaseUser?.uid || '',
    notes: '',
  });

  // Banking-style multi-field search (Name, Business, Phone, Email, Customer ID, Account Number)
  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.businessName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.customerCode.toLowerCase().includes(q) ||
        c.accountNumber.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const activeSalesReps = staffPublic.filter(
    (s) => s.employmentStatus === 'active' && ['sales', 'admin', 'super_admin'].includes(s.role)
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const assignedRep = activeSalesReps.find((s) => s.uid === form.salesRepUid);
      const created = await createCustomer({
        fullName: form.fullName,
        businessName: form.businessName,
        phone: form.phone,
        email: form.email,
        businessAddress: form.businessAddress,
        businessCategory: form.businessCategory,
        salesRepUid: form.salesRepUid || firebaseUser?.uid,
        salesRepName: assignedRep?.fullName || staffProfile?.fullName || 'VISIBYL Rep',
        notes: form.notes,
      });
      setShowAddModal(false);
      setSelectedCustomer(created);
      setForm({
        fullName: '',
        businessName: '',
        phone: '',
        email: '',
        businessAddress: '',
        businessCategory: '',
        salesRepUid: firebaseUser?.uid || '',
        notes: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register customer.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickOnboarding = async (cust: Customer) => {
    const created = await createOnboardingForm({
      customer: cust,
      servicePurchased: settings.services[0],
    });
    const link = `${window.location.origin}/?onboard=${created.id}`;
    await navigator.clipboard?.writeText(link).catch(() => {});
    setQuickMsg(`Private onboarding form ${created.formCode} generated and link copied to clipboard.`);
  };

  const customerProjects = selectedCustomer
    ? projects.filter((p) => p.customerId === selectedCustomer.id)
    : [];
  const customerInvoices = selectedCustomer
    ? invoices.filter((i) => i.customerId === selectedCustomer.id)
    : [];
  const customerPayments = selectedCustomer
    ? payments.filter((p) => p.customerId === selectedCustomer.id)
    : [];
  const customerForms = selectedCustomer
    ? onboardingForms.filter((f) => f.customerId === selectedCustomer.id)
    : [];

  const customerTotalPaid = customerPayments
    .filter((p) => p.verificationStatus === 'confirmed')
    .reduce((s, p) => s + p.amount, 0);
  const customerBalance = customerProjects.reduce(
    (s, p) => s + (projectFinancials.get(p.id)?.outstandingBalance || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Customer Accounts</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Search by Customer ID, 10-digit Account Number, name, phone, or email.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6] transition-colors whitespace-nowrap self-start"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register Customer</span>
        </button>
      </div>

      {/* Banking-Style Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400 ml-2 shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Banking lookup: Enter Name, Business, VSB-CUS-..., 308... Account No, Phone, or Email"
          className="w-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Customer Directory Table/List */}
        <div className={`${selectedCustomer ? 'lg:col-span-5' : 'lg:col-span-12'} bg-white border border-slate-200 rounded-xl overflow-hidden`}>
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              {filteredCustomers.length} Registered Customer{filteredCustomers.length === 1 ? '' : 's'}
            </span>
          </div>
          {filteredCustomers.length === 0 ? (
            <div className="p-10 text-center">
              <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No customers match your search</p>
              <p className="text-xs text-slate-500 mt-1">Register a customer to auto-generate their Customer ID and Account Number.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
              {filteredCustomers.map((c) => {
                const isSelected = selectedCustomer?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomer(c);
                      setQuickMsg(null);
                    }}
                    className={`w-full text-left p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
                      isSelected ? 'bg-[#F0F5FF]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono-tabular">
                        <span className="font-semibold text-[#0144D8]">{c.customerCode}</span>
                        <span>·</span>
                        <span>Acct {c.accountNumber}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 mt-1 truncate">{c.businessName}</p>
                      <p className="text-xs text-slate-600 truncate">
                        {c.fullName} · {c.phone} · {c.email}
                      </p>
                    </div>
                    <div className="sm:text-right text-xs text-slate-500 shrink-0">
                      <p>Rep: {c.salesRepName}</p>
                      <p className="font-mono-tabular mt-0.5">{formatDate(c.registrationDate)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Customer 360 Profile */}
        {selectedCustomer && (
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <p className="text-xs font-mono-tabular font-semibold text-[#0144D8]">
                  {selectedCustomer.customerCode} · Account #{selectedCustomer.accountNumber}
                </p>
                <h3 className="text-xl font-bold text-slate-900 mt-1">{selectedCustomer.businessName}</h3>
                <p className="text-xs text-slate-600 mt-1">
                  {selectedCustomer.fullName} · {selectedCustomer.phone} · {selectedCustomer.email}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{selectedCustomer.businessAddress}</p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {quickMsg && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                {quickMsg}
              </div>
            )}

            {/* Quick Financial Summary */}
            <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div>
                <p className="text-[11px] text-slate-500">Confirmed Paid</p>
                <p className="text-base font-bold font-mono-tabular text-emerald-700 mt-0.5">
                  {formatNaira(customerTotalPaid)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Outstanding Balance</p>
                <p className="text-base font-bold font-mono-tabular text-amber-700 mt-0.5">
                  {formatNaira(customerBalance)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Projects</p>
                <p className="text-base font-bold font-mono-tabular text-slate-900 mt-0.5">
                  {customerProjects.length}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => handleQuickOnboarding(selectedCustomer)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6]"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Generate Onboarding Link</span>
              </button>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('invoices')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Go to Invoices</span>
                </button>
              )}
            </div>

            {/* Linked Projects */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-2">Projects ({customerProjects.length})</h4>
              {customerProjects.length === 0 ? (
                <p className="text-xs text-slate-500">No projects linked yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {customerProjects.map((p) => {
                    const fin = projectFinancials.get(p.id);
                    return (
                      <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-2 text-xs">
                        <div>
                          <p className="font-semibold text-slate-900">{p.title}</p>
                          <p className="text-slate-500 font-mono-tabular">{p.projectCode} · {p.status} · {p.progressPercent}%</p>
                        </div>
                        {fin && (
                          <div className="text-right font-mono-tabular">
                            <p className="font-bold text-slate-900">{formatNaira(fin.agreedPrice)}</p>
                            <p className="text-slate-500">Bal: {formatNaira(fin.outstandingBalance)}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Linked Onboarding Forms & Uploaded Files */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-2">Onboarding Forms & Documents ({customerForms.length})</h4>
              {customerForms.length === 0 ? (
                <p className="text-xs text-slate-500">No onboarding forms generated yet.</p>
              ) : (
                <div className="space-y-2">
                  {customerForms.map((f) => (
                    <div key={f.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-900 font-mono-tabular">
                            {f.formCode} · {f.servicePurchased}
                          </p>
                          <p className="text-[11px] text-slate-500">Status: {f.status}</p>
                        </div>
                        {onOpenOnboarding && (
                          <button
                            onClick={() => onOpenOnboarding(f.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0144D8] hover:underline"
                          >
                            <span>Open Brief</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {(f.logoUrl || (f.attachmentUrls && f.attachmentUrls.length > 0)) && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {f.logoUrl && (
                            <a href={f.logoUrl} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-[#0144D8] underline">
                              Business Logo
                            </a>
                          )}
                          {f.attachmentUrls?.map((att, idx) => (
                            <a key={idx} href={att.url} target="_blank" rel="noreferrer" className="text-[11px] text-slate-700 underline">
                              {att.name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linked Invoices & Payments */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2">Invoices ({customerInvoices.length})</h4>
                {customerInvoices.length === 0 ? (
                  <p className="text-xs text-slate-500">No invoices yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                    {customerInvoices.map((inv) => (
                      <div key={inv.id} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-mono-tabular font-semibold text-slate-900">{inv.invoiceNumber}</p>
                          <p className="text-slate-500">{inv.status}</p>
                        </div>
                        <span className="font-mono-tabular font-bold text-slate-900">{formatNaira(inv.totalAmount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2">Transactions ({customerPayments.length})</h4>
                {customerPayments.length === 0 ? (
                  <p className="text-xs text-slate-500">No payments yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                    {customerPayments.map((pay) => (
                      <div key={pay.id} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-mono-tabular font-semibold text-slate-900">{pay.receiptNumber}</p>
                          <p className="text-slate-500 capitalize">{pay.verificationStatus}</p>
                        </div>
                        <span className="font-mono-tabular font-bold text-emerald-700">{formatNaira(pay.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Register New Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Register New Customer</h3>
                <p className="text-xs text-slate-500">Customer ID & unique 10-digit Account Number are generated automatically.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    required
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name *</label>
                  <input
                    required
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+234..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Business Category</label>
                  <input
                    value={form.businessCategory}
                    onChange={(e) => setForm({ ...form, businessCategory: e.target.value })}
                    placeholder="e.g. Retail, Logistics"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                {isAdmin && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Sales Rep</label>
                    <select
                      value={form.salesRepUid}
                      onChange={(e) => setForm({ ...form, salesRepUid: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                    >
                      {activeSalesReps.map((rep) => (
                        <option key={rep.uid} value={rep.uid}>
                          {rep.fullName} ({rep.staffCode})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Business Address *</label>
                <input
                  required
                  value={form.businessAddress}
                  onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6]"
                >
                  <Plus className="w-4 h-4" />
                  <span>{saving ? 'Registering...' : 'Save Customer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
