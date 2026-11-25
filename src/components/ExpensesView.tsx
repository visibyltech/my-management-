import React, { useMemo, useState } from 'react';
import { ExternalLink, Plus, Receipt, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { uploadVisibylFile } from '../lib/firebase';
import { EXPENSE_CATEGORIES, formatDate, formatNaira, isWithinTimeframe, TimeframeFilter, todayISO } from '../utils/formatters';

export const ExpensesView: React.FC = () => {
  const { staffProfile, firebaseUser } = useAuth();
  const { expenses, payments, createExpense } = useData();

  const [timeframe, setTimeframe] = useState<TimeframeFilter>('monthly');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    description: '',
    category: EXPENSE_CATEGORIES[0],
    amount: '',
    expenseDate: todayISO(),
    paymentMethod: 'Bank Transfer (Kuda)',
    responsiblePerson: staffProfile?.fullName || firebaseUser?.displayName || '',
    receiptUrl: '',
    receiptName: '',
  });

  const periodStats = useMemo(() => {
    const confirmedRev = payments
      .filter((p) => p.verificationStatus === 'confirmed' && isWithinTimeframe(p.paymentDate || p.createdAt, timeframe))
      .reduce((s, p) => s + p.amount, 0);

    const periodExpenses = expenses.filter((e) => isWithinTimeframe(e.expenseDate || e.createdAt, timeframe));
    const totalPeriodExpense = periodExpenses.reduce((s, e) => s + e.amount, 0);

    const daily = expenses.filter((e) => isWithinTimeframe(e.expenseDate, 'daily')).reduce((s, e) => s + e.amount, 0);
    const weekly = expenses.filter((e) => isWithinTimeframe(e.expenseDate, 'weekly')).reduce((s, e) => s + e.amount, 0);
    const monthly = expenses.filter((e) => isWithinTimeframe(e.expenseDate, 'monthly')).reduce((s, e) => s + e.amount, 0);
    const yearly = expenses.filter((e) => isWithinTimeframe(e.expenseDate, 'yearly')).reduce((s, e) => s + e.amount, 0);

    return {
      confirmedRev,
      totalPeriodExpense,
      netIncome: confirmedRev - totalPeriodExpense,
      daily,
      weekly,
      monthly,
      yearly,
    };
  }, [expenses, payments, timeframe]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(
      (e) =>
        isWithinTimeframe(e.expenseDate || e.createdAt, timeframe) &&
        (catFilter === 'all' || e.category === catFilter)
    );
  }, [expenses, timeframe, catFilter]);

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadVisibylFile('receipts', file);
      setForm((prev) => ({ ...prev, receiptUrl: res.url, receiptName: res.name }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Receipt upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createExpense({
        description: form.description,
        category: form.category,
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        paymentMethod: form.paymentMethod,
        responsiblePerson: form.responsiblePerson,
        receiptUrl: form.receiptUrl,
        receiptName: form.receiptName,
      });
      setShowAddModal(false);
      setForm({
        description: '',
        category: EXPENSE_CATEGORIES[0],
        amount: '',
        expenseDate: todayISO(),
        paymentMethod: 'Bank Transfer (Kuda)',
        responsiblePerson: staffProfile?.fullName || firebaseUser?.displayName || '',
        receiptUrl: '',
        receiptName: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record expense.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Company Expenses & Net Income</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Track hosting, domains, ads, staff payouts, and operating costs against confirmed revenue.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6] whitespace-nowrap self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Record Expense</span>
        </button>
      </div>

      {/* Daily, Weekly, Monthly, Yearly Expense Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">Today's Expenses</p>
          <p className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">{formatNaira(periodStats.daily)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">This Week</p>
          <p className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">{formatNaira(periodStats.weekly)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">This Month</p>
          <p className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">{formatNaira(periodStats.monthly)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">This Year</p>
          <p className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">{formatNaira(periodStats.yearly)}</p>
        </div>
      </div>

      {/* Period Net Income Banner */}
      <div className="bg-[#0B1B3D] text-white rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6 font-mono-tabular">
          <div>
            <p className="text-[11px] text-blue-200 font-sans">Confirmed Revenue ({timeframe})</p>
            <p className="text-lg font-bold text-white">{formatNaira(periodStats.confirmedRev)}</p>
          </div>
          <div>
            <p className="text-[11px] text-blue-200 font-sans">Expenses ({timeframe})</p>
            <p className="text-lg font-bold text-amber-300">{formatNaira(periodStats.totalPeriodExpense)}</p>
          </div>
          <div>
            <p className="text-[11px] text-blue-200 font-sans">Net Income ({timeframe})</p>
            <p className={`text-lg font-bold ${periodStats.netIncome >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {formatNaira(periodStats.netIncome)}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-white/10 rounded-lg self-start">
          {(['daily', 'weekly', 'monthly', 'yearly', 'all'] as TimeframeFilter[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${
                timeframe === tf ? 'bg-white text-[#0B1B3D]' : 'text-blue-100 hover:text-white'
              }`}
            >
              {tf === 'all' ? 'All' : tf}
            </button>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setCatFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
            catFilter === 'all' ? 'bg-[#0144D8] text-white' : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          All Categories
        </button>
        {EXPENSE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              catFilter === cat ? 'bg-[#0144D8] text-white' : 'bg-white border border-slate-200 text-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Expense Ledger */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredExpenses.length === 0 ? (
          <div className="p-10 text-center">
            <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No expenses recorded for this selection</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-5">Code & Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Date & Method</th>
                  <th className="py-3 px-4">Responsible</th>
                  <th className="py-3 px-4">Receipt</th>
                  <th className="py-3 px-5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredExpenses.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-5">
                      <p className="font-mono-tabular font-semibold text-[#0144D8]">{ex.expenseCode}</p>
                      <p className="font-bold text-slate-900 mt-0.5">{ex.description}</p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">{ex.category}</td>
                    <td className="py-3.5 px-4">
                      <p className="font-mono-tabular text-slate-700">{formatDate(ex.expenseDate)}</p>
                      <p className="text-slate-500">{ex.paymentMethod}</p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">{ex.responsiblePerson}</td>
                    <td className="py-3.5 px-4">
                      {ex.receiptUrl ? (
                        <a
                          href={ex.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[#0144D8] font-semibold hover:underline"
                        >
                          <span>View</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right font-bold font-mono-tabular text-slate-900">
                      {formatNaira(ex.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Record Business Expense</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description *</label>
                <input
                  required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Cloud Hosting & Domain Renewal"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₦) *</label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Date *</label>
                  <input
                    required
                    type="date"
                    value={form.expenseDate}
                    onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method *</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="Bank Transfer (Kuda)">Bank Transfer (Kuda)</option>
                    <option value="Corporate Card">Corporate Card</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Person Responsible *</label>
                <input
                  required
                  value={form.responsiblePerson}
                  onChange={(e) => setForm({ ...form, responsiblePerson: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt Upload (Optional)</label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer">
                    <Upload className="w-4 h-4 text-[#0144D8]" />
                    <span>{uploading ? 'Uploading...' : 'Upload Receipt'}</span>
                    <input type="file" onChange={handleReceiptUpload} className="hidden" />
                  </label>
                  {form.receiptName && <span className="text-xs text-emerald-700 truncate">{form.receiptName}</span>}
                </div>
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
                  disabled={saving || uploading}
                  className="px-5 py-2 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6]"
                >
                  {saving ? 'Recording...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
