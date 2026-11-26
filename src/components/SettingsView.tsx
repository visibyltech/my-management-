import React, { useEffect, useState } from 'react';
import { CheckCircle2, Landmark, Lock, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { CompanySettings } from '../types/visibyl';
import { formatNaira } from '../utils/formatters';

export const SettingsView: React.FC = () => {
  const { isSuperAdmin, staffProfile } = useAuth();
  const { settings, updateCompanySettings, updateOwnStaffProfile } = useData();

  const [companyForm, setCompanyForm] = useState<CompanySettings>(settings);
  const [newDept, setNewDept] = useState('');
  const [newService, setNewService] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyMsg, setCompanyMsg] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState({
    fullName: staffProfile?.fullName || '',
    phone: staffProfile?.phone || '',
    bankName: staffProfile?.bankName || '',
    bankAccountNumber: staffProfile?.bankAccountNumber || '',
    bankAccountName: staffProfile?.bankAccountName || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);


  useEffect(() => {
    setCompanyForm(settings);
  }, [settings]);

  useEffect(() => {
    if (staffProfile) {
      setProfileForm({
        fullName: staffProfile.fullName || '',
        phone: staffProfile.phone || '',
        bankName: staffProfile.bankName || '',
        bankAccountNumber: staffProfile.bankAccountNumber || '',
        bankAccountName: staffProfile.bankAccountName || '',
      });
    }
  }, [staffProfile]);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCompany(true);
    setCompanyMsg(null);
    try {
      await updateCompanySettings(companyForm);
      setCompanyMsg('Company settings and bank configuration saved.');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      await updateOwnStaffProfile(profileForm);
      setProfileMsg('Personal profile and payout bank details updated.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Settings & Platform Configuration</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage your staff payout profile and company configuration.
        </p>
      </div>

      {/* Staff Personal Profile & Bank Account */}
      {staffProfile && (
        <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Your Staff Profile & Payout Account</h3>
              <p className="text-xs text-slate-500">
                Staff ID: <span className="font-mono-tabular font-semibold">{staffProfile.staffCode}</span> · {staffProfile.department} ({staffProfile.position})
              </p>
            </div>
          </div>

          {profileMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{profileMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                required
                value={profileForm.fullName}
                onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Salary / Commission Bank Name</label>
              <input
                value={profileForm.bankName}
                onChange={(e) => setProfileForm({ ...profileForm, bankName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account Number</label>
              <input
                value={profileForm.bankAccountNumber}
                onChange={(e) => setProfileForm({ ...profileForm, bankAccountNumber: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Account Name</label>
              <input
                value={profileForm.bankAccountName}
                onChange={(e) => setProfileForm({ ...profileForm, bankAccountName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-2 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6]"
            >
              {savingProfile ? 'Saving...' : 'Update My Profile'}
            </button>
          </div>
        </form>
      )}

      {/* Permanent Company Bank Details & Super Admin Controls */}
      <form onSubmit={handleSaveCompany} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-[#0144D8]" />
            <h3 className="text-sm font-bold text-slate-900">Official Company Bank Details & Governance</h3>
          </div>
          {!isSuperAdmin && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
              <Lock className="w-3.5 h-3.5" />
              <span>Locked to Super Admin</span>
            </span>
          )}
        </div>

        {companyMsg && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
            {companyMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#F0F5FF] border border-blue-100">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Account Name</label>
            <input
              disabled={!isSuperAdmin}
              value={companyForm.bankAccountName}
              onChange={(e) => setCompanyForm({ ...companyForm, bankAccountName: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 px-3 py-2 text-sm font-bold"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bank</label>
            <input
              disabled={!isSuperAdmin}
              value={companyForm.bankName}
              onChange={(e) => setCompanyForm({ ...companyForm, bankName: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 px-3 py-2 text-sm font-bold"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Account Number</label>
            <input
              disabled={!isSuperAdmin}
              pattern="^[0-9]{10}$"
              value={companyForm.bankAccountNumber}
              onChange={(e) => setCompanyForm({ ...companyForm, bankAccountNumber: e.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 px-3 py-2 text-sm font-bold font-mono-tabular text-[#0144D8]"
            />
          </div>
        </div>

        {isSuperAdmin && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Minimum Customer Payment (₦)
                </label>
                <input
                  type="number"
                  min={0}
                  value={companyForm.minimumPaymentAmount}
                  onChange={(e) => setCompanyForm({ ...companyForm, minimumPaymentAmount: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular"
                />
                <p className="text-[11px] text-slate-400 mt-1">Current: {formatNaira(companyForm.minimumPaymentAmount)}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Commission Mode</label>
                <select
                  value={companyForm.commissionMode}
                  onChange={(e) => setCompanyForm({ ...companyForm, commissionMode: e.target.value as 'percentage' | 'fixed' })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₦)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Commission %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={companyForm.defaultCommissionRate}
                  onChange={(e) => setCompanyForm({ ...companyForm, defaultCommissionRate: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Default Fixed Commission (₦)</label>
                <input
                  type="number"
                  min={0}
                  value={companyForm.defaultFixedCommission}
                  onChange={(e) => setCompanyForm({ ...companyForm, defaultFixedCommission: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
            </div>

            {/* Departments & Services Catalogs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-slate-100">
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-slate-800">Company Departments</label>
                <div className="flex gap-2">
                  <input
                    value={newDept}
                    onChange={(e) => setNewDept(e.target.value)}
                    placeholder="Add department..."
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newDept.trim() && !companyForm.departments.includes(newDept.trim())) {
                        setCompanyForm({ ...companyForm, departments: [...companyForm.departments, newDept.trim()] });
                        setNewDept('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {companyForm.departments.map((d) => (
                    <div key={d} className="px-3 py-2 flex items-center justify-between text-xs">
                      <span>{d}</span>
                      {companyForm.departments.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setCompanyForm({
                              ...companyForm,
                              departments: companyForm.departments.filter((x) => x !== d),
                            })
                          }
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-slate-800">Service Offerings</label>
                <div className="flex gap-2">
                  <input
                    value={newService}
                    onChange={(e) => setNewService(e.target.value)}
                    placeholder="Add service..."
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newService.trim() && !companyForm.services.includes(newService.trim())) {
                        setCompanyForm({ ...companyForm, services: [...companyForm.services, newService.trim()] });
                        setNewService('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-56 overflow-y-auto">
                  {companyForm.services.map((s) => (
                    <div key={s} className="px-3 py-2 flex items-center justify-between text-xs">
                      <span>{s}</span>
                      {companyForm.services.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setCompanyForm({
                              ...companyForm,
                              services: companyForm.services.filter((x) => x !== s),
                            })
                          }
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingCompany}
                className="px-5 py-2.5 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6]"
              >
                {savingCompany ? 'Saving Settings...' : 'Save Company Configuration'}
              </button>
            </div>
          </>
        )}
      </form>

    </div>
  );
};
