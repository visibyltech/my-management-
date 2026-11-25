import React, { useMemo, useState } from 'react';
import { BadgePercent, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Commission } from '../types/visibyl';
import { formatDate, formatNaira } from '../utils/formatters';

export const CommissionsView: React.FC = () => {
  const { isAdmin, isFinance } = useAuth();
  const { customers, payments, commissions, settings, updateCommissionPayout } = useData();

  const [payingCommission, setPayingCommission] = useState<Commission | null>(null);
  const [payoutRef, setPayoutRef] = useState('');
  const [saving, setSaving] = useState(false);

  const repSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        uid: string;
        name: string;
        customersCount: number;
        successfulSalesCount: number;
        confirmedPayments: number;
        commissionEarned: number;
        commissionPaid: number;
        outstandingCommission: number;
      }
    >();

    customers.forEach((c) => {
      if (!c.salesRepUid) return;
      const entry = map.get(c.salesRepUid) || {
        uid: c.salesRepUid,
        name: c.salesRepName,
        customersCount: 0,
        successfulSalesCount: 0,
        confirmedPayments: 0,
        commissionEarned: 0,
        commissionPaid: 0,
        outstandingCommission: 0,
      };
      entry.customersCount += 1;
      map.set(c.salesRepUid, entry);
    });

    const projectSetMap = new Map<string, Set<string>>();
    payments
      .filter((p) => p.verificationStatus === 'confirmed')
      .forEach((p) => {
        if (!p.salesRepUid) return;
        const entry = map.get(p.salesRepUid) || {
          uid: p.salesRepUid,
          name: 'Sales Rep',
          customersCount: 0,
          successfulSalesCount: 0,
          confirmedPayments: 0,
          commissionEarned: 0,
          commissionPaid: 0,
          outstandingCommission: 0,
        };
        entry.confirmedPayments += p.amount;
        const pSet = projectSetMap.get(p.salesRepUid) || new Set<string>();
        pSet.add(p.projectId);
        projectSetMap.set(p.salesRepUid, pSet);
        entry.successfulSalesCount = pSet.size;
        map.set(p.salesRepUid, entry);
      });

    commissions.forEach((cm) => {
      const entry = map.get(cm.salesRepUid) || {
        uid: cm.salesRepUid,
        name: cm.salesRepName,
        customersCount: 0,
        successfulSalesCount: 0,
        confirmedPayments: 0,
        commissionEarned: 0,
        commissionPaid: 0,
        outstandingCommission: 0,
      };
      entry.commissionEarned += cm.commissionAmount;
      if (cm.payoutStatus === 'paid') {
        entry.commissionPaid += cm.commissionAmount;
      } else {
        entry.outstandingCommission += cm.commissionAmount;
      }
      map.set(cm.salesRepUid, entry);
    });

    return Array.from(map.values()).sort((a, b) => b.commissionEarned - a.commissionEarned);
  }, [customers, payments, commissions]);

  const handleMarkPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCommission) return;
    setSaving(true);
    try {
      await updateCommissionPayout(payingCommission.id, 'paid', payoutRef);
      setPayingCommission(null);
      setPayoutRef('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Sales Commissions</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Company rule:{' '}
          <span className="font-semibold text-slate-800">
            {settings.commissionMode === 'percentage'
              ? `${settings.defaultCommissionRate}% of confirmed customer payments`
              : `${formatNaira(settings.defaultFixedCommission)} fixed per confirmed payment`}
          </span>
        </p>
      </div>

      {/* Per-Salesperson Breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-800">Sales Representative Summary</h3>
        </div>
        {repSummaries.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">No sales commission activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-5">Sales Representative</th>
                  <th className="py-3 px-4 text-right">Customers</th>
                  <th className="py-3 px-4 text-right">Successful Sales</th>
                  <th className="py-3 px-4 text-right">Confirmed Payments</th>
                  <th className="py-3 px-4 text-right">Earned</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-5 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-mono-tabular">
                {repSummaries.map((rep) => (
                  <tr key={rep.uid} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-5 font-sans font-bold text-slate-900">{rep.name}</td>
                    <td className="py-3.5 px-4 text-right text-slate-700">{rep.customersCount}</td>
                    <td className="py-3.5 px-4 text-right text-slate-700">{rep.successfulSalesCount}</td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-900">{formatNaira(rep.confirmedPayments)}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#0144D8]">{formatNaira(rep.commissionEarned)}</td>
                    <td className="py-3.5 px-4 text-right text-emerald-700">{formatNaira(rep.commissionPaid)}</td>
                    <td className="py-3.5 px-5 text-right font-bold text-amber-700">{formatNaira(rep.outstandingCommission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Commission Ledger */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-800">Commission Ledger ({commissions.length})</h3>
        </div>
        {commissions.length === 0 ? (
          <div className="p-10 text-center">
            <BadgePercent className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No commissions accrued yet</p>
            <p className="text-xs text-slate-500 mt-1">Commissions generate automatically when Admin confirms a customer payment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-5">Sales Rep</th>
                  <th className="py-3 px-4">Customer / Project</th>
                  <th className="py-3 px-4 text-right">Confirmed Payment</th>
                  <th className="py-3 px-4 text-right">Commission</th>
                  <th className="py-3 px-4">Payout Status</th>
                  {(isAdmin || isFinance) && <th className="py-3 px-5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {commissions.map((cm) => (
                  <tr key={cm.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-5 font-bold text-slate-900">{cm.salesRepName}</td>
                    <td className="py-3.5 px-4">
                      <p className="text-slate-800">{cm.customerName || cm.customerId}</p>
                      <p className="text-slate-500 font-mono-tabular">{cm.projectCode || cm.projectId}</p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-tabular text-slate-700">
                      {formatNaira(cm.confirmedPaymentAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-tabular font-bold text-[#0144D8]">
                      {formatNaira(cm.commissionAmount)}
                      <p className="text-[10px] font-normal text-slate-400">
                        {cm.commissionType === 'percentage' ? `${cm.commissionRate}%` : 'Fixed'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-semibold capitalize ${
                          cm.payoutStatus === 'paid'
                            ? 'text-emerald-700'
                            : cm.payoutStatus === 'approved'
                              ? 'text-[#0144D8]'
                              : 'text-amber-700'
                        }`}
                      >
                        {cm.payoutStatus === 'paid' && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />}
                        {cm.payoutStatus}
                      </span>
                      {cm.payoutReference && (
                        <p className="text-[11px] font-mono-tabular text-slate-500">Ref: {cm.payoutReference}</p>
                      )}
                      {cm.paidAt && <p className="text-[10px] text-slate-400">{formatDate(cm.paidAt)}</p>}
                    </td>
                    {(isAdmin || isFinance) && (
                      <td className="py-3.5 px-5 text-right whitespace-nowrap space-x-2">
                        {cm.payoutStatus === 'unpaid' && (
                          <button
                            onClick={() => updateCommissionPayout(cm.id, 'approved')}
                            className="px-3 py-1.5 rounded-lg border border-[#0144D8] text-[#0144D8] font-semibold hover:bg-[#F0F5FF]"
                          >
                            Approve
                          </button>
                        )}
                        {cm.payoutStatus !== 'paid' && (
                          <button
                            onClick={() => {
                              setPayingCommission(cm);
                              setPayoutRef('');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                          >
                            Record Payout
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Commission Payout Modal */}
      {payingCommission && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Record Commission Payout</h3>
              <button onClick={() => setPayingCommission(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleMarkPaid} className="mt-4 space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <p className="font-bold text-slate-900">{payingCommission.salesRepName}</p>
                <p className="text-slate-600 mt-0.5 font-mono-tabular">
                  Payout Amount: <strong className="text-[#0144D8]">{formatNaira(payingCommission.commissionAmount)}</strong>
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Transfer / Payout Reference *</label>
                <input
                  required
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                  placeholder="e.g. KUDA-COMM-88120"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingCommission(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                >
                  {saving ? 'Recording...' : 'Confirm Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
