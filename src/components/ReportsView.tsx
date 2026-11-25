import React, { useMemo } from 'react';
import { Download, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatDateTime, formatNaira, isWithinTimeframe, TimeframeFilter } from '../utils/formatters';

export const ReportsView: React.FC = () => {
  const { isAdmin, isFinance } = useAuth();
  const {
    customers,
    projects,
    projectFinancials,
    invoices,
    payments,
    commissions,
    expenses,
    staffMembers,
    activityLogs,
    settings,
  } = useData();

  const summaryRows = useMemo(() => {
    const periods: { key: TimeframeFilter; label: string }[] = [
      { key: 'daily', label: 'Daily (Today)' },
      { key: 'weekly', label: 'Weekly (7 Days)' },
      { key: 'monthly', label: 'Monthly (Current Month)' },
      { key: 'yearly', label: 'Yearly (Current Year)' },
      { key: 'all', label: 'All-Time Cumulative' },
    ];

    return periods.map((p) => {
      const revenue = payments
        .filter((pay) => pay.verificationStatus === 'confirmed' && isWithinTimeframe(pay.paymentDate || pay.createdAt, p.key))
        .reduce((s, pay) => s + pay.amount, 0);
      const expense = expenses
        .filter((ex) => isWithinTimeframe(ex.expenseDate || ex.createdAt, p.key))
        .reduce((s, ex) => s + ex.amount, 0);
      return {
        label: p.label,
        revenue,
        expense,
        net: revenue - expense,
      };
    });
  }, [payments, expenses]);

  const categoryExpenses = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const handleBackupDownload = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      organization: settings.companyName,
      settings,
      customers,
      projects,
      projectFinancials: Array.from(projectFinancials.values()),
      invoices,
      payments,
      commissions,
      expenses,
      staff: isAdmin ? staffMembers : [],
      activityLogs: isAdmin ? activityLogs : [],
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visibyl-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Financial Reports & Audit History</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Automated Naira P&L summaries, expense distribution, activity logs, and encrypted JSON database backups.
          </p>
        </div>
        {(isAdmin || isFinance) && (
          <button
            onClick={handleBackupDownload}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6] whitespace-nowrap self-start"
          >
            <Download className="w-4 h-4" />
            <span>Export JSON Backup</span>
          </button>
        )}
      </div>

      {/* Period Financial Summary */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-800">Revenue, Expenses & Net Income (Confirmed Payments Only)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-5">Reporting Period</th>
                <th className="py-3 px-4 text-right">Confirmed Revenue</th>
                <th className="py-3 px-4 text-right">Expenses</th>
                <th className="py-3 px-5 text-right">Net Income</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-mono-tabular">
              {summaryRows.map((row) => (
                <tr key={row.label} className="hover:bg-slate-50/70">
                  <td className="py-3.5 px-5 font-sans font-bold text-slate-900">{row.label}</td>
                  <td className="py-3.5 px-4 text-right font-semibold text-[#0144D8]">{formatNaira(row.revenue)}</td>
                  <td className="py-3.5 px-4 text-right text-slate-700">{formatNaira(row.expense)}</td>
                  <td className={`py-3.5 px-5 text-right font-bold ${row.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatNaira(row.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense Breakdown & Immutable Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {(isAdmin || isFinance) && (
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-800">Expenses by Category</h3>
            </div>
            {categoryExpenses.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">No expense categories logged yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {categoryExpenses.map(([cat, total]) => (
                  <div key={cat} className="px-5 py-3 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{cat}</span>
                    <span className="font-mono-tabular font-bold text-slate-900">{formatNaira(total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isAdmin && (
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800">Immutable Activity & Audit Log</h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Tamper-Protected</span>
              </span>
            </div>
            {activityLogs.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">No activity recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {activityLogs.slice(0, 40).map((log) => (
                  <div key={log.id} className="px-5 py-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{log.actorName}</span>
                      <span className="text-[11px] font-mono-tabular text-slate-400">{formatDateTime(log.createdAt)}</span>
                    </div>
                    <p className="text-slate-600 mt-0.5">{log.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
