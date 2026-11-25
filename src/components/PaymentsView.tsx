import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, CreditCard, Plus, X, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Payment } from '../types/visibyl';
import { formatDate, formatNaira, todayISO } from '../utils/formatters';

export const PaymentsView: React.FC = () => {
  const { isAdmin, isFinance, isSuperAdmin } = useAuth();
  const {
    projects,
    projectFinancials,
    invoices,
    payments,
    settings,
    recordPayment,
    verifyPayment,
  } = useData();

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('all');
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const [projectId, setProjectId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer (Kuda)');
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');

  const filteredPayments = useMemo(() => {
    if (statusFilter === 'all') return payments;
    return payments.filter((p) => p.verificationStatus === statusFilter);
  }, [payments, statusFilter]);

  const totals = useMemo(() => {
    const confirmed = payments.filter((p) => p.verificationStatus === 'confirmed').reduce((s, p) => s + p.amount, 0);
    const pending = payments.filter((p) => p.verificationStatus === 'pending').reduce((s, p) => s + p.amount, 0);
    return { confirmed, pending };
  }, [payments]);

  const selectedProject = projects.find((p) => p.id === projectId);
  const selectedFin = selectedProject ? projectFinancials.get(selectedProject.id) : undefined;

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) {
      setError('Please select a project.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const inv = invoices.find((i) => i.id === invoiceId);
      await recordPayment({
        project: selectedProject,
        invoice: inv,
        amount: Number(amount),
        paymentMethod,
        paymentDate,
        transactionReference,
        notes,
      });
      setShowRecordModal(false);
      setAmount('');
      setTransactionReference('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (payment: Payment, decision: 'confirmed' | 'rejected') => {
    setVerifyingId(payment.id);
    try {
      await verifyPayment(payment, decision);
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Payment Tracking & Verification</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Minimum standard payment: <span className="font-mono-tabular font-semibold">{formatNaira(settings.minimumPaymentAmount)}</span> · Remitted to {settings.bankName} ({settings.bankAccountNumber}).
          </p>
        </div>
        <button
          onClick={() => {
            setProjectId(projects[0]?.id || '');
            setShowRecordModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6] whitespace-nowrap self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Record Payment</span>
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Confirmed Received</p>
          <p className="text-2xl font-bold font-mono-tabular text-emerald-700 mt-1">{formatNaira(totals.confirmed)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Pending Admin Verification</p>
          <p className="text-2xl font-bold font-mono-tabular text-amber-700 mt-1">{formatNaira(totals.pending)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Total Transactions</p>
          <p className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1">{payments.length}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(['all', 'pending', 'confirmed', 'rejected'] as const).map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap ${
              statusFilter === st ? 'bg-[#0144D8] text-white' : 'bg-white border border-slate-200 text-slate-700'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Payments Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredPayments.length === 0 ? (
          <div className="p-10 text-center">
            <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No payments in this view</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-5">Receipt / Reference</th>
                  <th className="py-3 px-4">Customer & Project</th>
                  <th className="py-3 px-4">Method & Date</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Verification</th>
                  {(isAdmin || isFinance) && <th className="py-3 px-5 text-right">Admin Control</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredPayments.map((p) => {
                  const fin = projectFinancials.get(p.projectId);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-5 font-mono-tabular">
                        <p className="font-bold text-[#0144D8]">{p.receiptNumber}</p>
                        <p className="text-slate-600">Ref: {p.transactionReference}</p>
                        <p className="text-slate-400">By: {p.recordedByName}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{p.customerName}</p>
                        <p className="text-slate-500 font-mono-tabular">
                          {p.projectCode || p.projectId}
                          {fin ? ` · Bal: ${formatNaira(fin.outstandingBalance)}` : ''}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-slate-800">{p.paymentMethod}</p>
                        <p className="text-slate-500 font-mono-tabular">{formatDate(p.paymentDate)}</p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold font-mono-tabular text-slate-900">
                        {formatNaira(p.amount)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold capitalize ${
                            p.verificationStatus === 'confirmed'
                              ? 'text-emerald-700'
                              : p.verificationStatus === 'rejected'
                                ? 'text-red-700'
                                : 'text-amber-700'
                          }`}
                        >
                          {p.verificationStatus === 'confirmed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {p.verificationStatus === 'pending' && <Clock className="w-3.5 h-3.5" />}
                          {p.verificationStatus === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
                          <span>{p.verificationStatus}</span>
                        </span>
                        {p.verifiedByName && (
                          <p className="text-[11px] text-slate-400 mt-0.5">by {p.verifiedByName}</p>
                        )}
                      </td>
                      {(isAdmin || isFinance) && (
                        <td className="py-3.5 px-5 text-right whitespace-nowrap space-x-2">
                          {p.verificationStatus === 'pending' ? (
                            <>
                              <button
                                disabled={verifyingId === p.id}
                                onClick={() => handleVerify(p, 'confirmed')}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Confirm Receipt
                              </button>
                              <button
                                disabled={verifyingId === p.id}
                                onClick={() => handleVerify(p, 'rejected')}
                                className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 font-semibold hover:bg-red-50 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-slate-400">Locked</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Customer Payment</h3>
                <p className="text-xs text-slate-500">Remains pending until an authorized Admin confirms receipt.</p>
              </div>
              <button onClick={() => setShowRecordModal(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRecord} className="mt-4 space-y-4">
              {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Project *</label>
                <select
                  required
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">Select project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectCode} — {p.customerBusinessName} ({p.title})
                    </option>
                  ))}
                </select>
              </div>

              {selectedFin && (
                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-[#F0F5FF] border border-blue-100 text-xs font-mono-tabular">
                  <div>
                    <p className="text-[10px] text-slate-500">Agreed Price</p>
                    <p className="font-bold text-slate-900">{formatNaira(selectedFin.agreedPrice)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Paid</p>
                    <p className="font-bold text-emerald-700">{formatNaira(selectedFin.totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">Outstanding</p>
                    <p className="font-bold text-[#0144D8]">{formatNaira(selectedFin.outstandingBalance)}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Linked Invoice (Optional)</label>
                <select
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">None</option>
                  {invoices
                    .filter((i) => !selectedProject || i.customerId === selectedProject.customerId)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.invoiceNumber} — Bal: {formatNaira(i.outstandingBalance)}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount (₦) * {isSuperAdmin ? '' : `(Min ${formatNaira(settings.minimumPaymentAmount)})`}
                  </label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 100000"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date *</label>
                  <input
                    required
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="Bank Transfer (Kuda)">Bank Transfer (Kuda)</option>
                    <option value="Bank Transfer">Bank Transfer (Other)</option>
                    <option value="POS">POS</option>
                    <option value="Cash">Cash</option>
                    <option value="Online">Online Checkout</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction Reference *</label>
                  <input
                    required
                    value={transactionReference}
                    onChange={(e) => setTransactionReference(e.target.value)}
                    placeholder="e.g. KUDA-99284102"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6]"
                >
                  {saving ? 'Recording...' : 'Submit for Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
