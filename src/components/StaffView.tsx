import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, KeyRound, Plus, ShieldBan, UserCheck, UserPlus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { EmploymentStatus, StaffMember, StaffRole } from '../types/visibyl';
import { formatDate, formatNaira } from '../utils/formatters';

interface StaffViewProps { initialSelectedUid?: string | null; }
export const StaffView: React.FC<StaffViewProps> = ({ initialSelectedUid }) => {
  const { isSuperAdmin } = useAuth();
  const {
    staffMembers,
    staffInvites,
    settings,
    customers,
    payments,
    commissions,
    inviteStaff,
    updateStaffStatusAndRole,
    revokeStaffInvite,
  } = useData();

  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [inviteForm, setInviteForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    department: settings.departments[0] || 'Sales and Marketing',
    position: '',
    role: 'sales' as Exclude<StaffRole, 'super_admin'>,
    bankName: '',
    bankAccountNumber: '',
    bankAccountName: '',
  });

  const [editForm, setEditForm] = useState({
    role: 'sales' as StaffRole,
    department: '',
    position: '',
    employmentStatus: 'active' as EmploymentStatus,
    commissionRateOverride: '',
  });

  const filteredStaff = useMemo(() => {
    if (deptFilter === 'all') return staffMembers;
    return staffMembers.filter((s) => s.department === deptFilter);
  }, [staffMembers, deptFilter]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      const inv = await inviteStaff(inviteForm);
      setShowInviteModal(false);
      setStatusMsg(
        `Staff invite ${inv.staffCode} created for ${inv.email}. When they sign in with Google using that email, their account will activate automatically.`
      );
      setInviteForm({
        fullName: '',
        email: '',
        phone: '',
        department: settings.departments[0] || 'Sales and Marketing',
        position: '',
        role: 'sales',
        bankName: '',
        bankAccountNumber: '',
        bankAccountName: '',
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditStaff = (member: StaffMember) => {
    setEditingStaff(member);
    setEditForm({
      role: member.role,
      department: member.department,
      position: member.position,
      employmentStatus: member.employmentStatus,
      commissionRateOverride:
        typeof member.commissionRateOverride === 'number' ? String(member.commissionRateOverride) : '',
    });
  };

  useEffect(() => {
    if (!initialSelectedUid) return;
    const selected = staffMembers.find((member) => member.uid === initialSelectedUid);
    if (selected) openEditStaff(selected);
  }, [initialSelectedUid, staffMembers]);

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setSaving(true);
    try {
      await updateStaffStatusAndRole(editingStaff.uid, {
        role: editForm.role,
        department: editForm.department,
        position: editForm.position,
        employmentStatus: editForm.employmentStatus,
        commissionRateOverride:
          editForm.commissionRateOverride !== '' ? Number(editForm.commissionRateOverride) : undefined,
      });
      setEditingStaff(null);
      setStatusMsg(`Updated staff profile for ${editingStaff.fullName}.`);
    } catch (error) {
      console.error('Unable to update staff profile:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatusMsg(`Staff changes were not saved: ${message.includes('permission-denied') ? 'Firestore denied this update. Please check the staff access rules.' : message.slice(0, 220)}`);
    } finally {
      setSaving(false);
    }
  };

  const quickStatusChange = async (member: StaffMember, nextStatus: EmploymentStatus) => {
    await updateStaffStatusAndRole(member.uid, { employmentStatus: nextStatus });
    setStatusMsg(`${member.fullName} status updated to ${nextStatus}.`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#0144D8] mb-1">VISIBYL TECHNOLOGIES · PEOPLE</p>
          <h2 className="text-xl font-bold tracking-tight text-slate-950">Team & Workforce</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage VISIBYL employees, departments, payout accounts, roles, and access approvals.
          </p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6] whitespace-nowrap self-start"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create / Invite Staff</span>
          </button>
        )}
      </div>

      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900">
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500">Total Team</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{staffMembers.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500">Active Staff</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-700">{staffMembers.filter((member) => member.employmentStatus === 'active').length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500">Pending Access</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-amber-700">{staffMembers.filter((member) => member.employmentStatus === 'pending').length + staffInvites.filter((invite) => invite.status === 'invited').length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500">Departments</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-[#0144D8]">{settings.departments.length}</p>
        </div>
      </div>

      {/* Department Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setDeptFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
            deptFilter === 'all' ? 'bg-[#0144D8] text-white' : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          All Departments ({staffMembers.length})
        </button>
        {settings.departments.map((dept) => (
          <button
            key={dept}
            onClick={() => setDeptFilter(dept)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              deptFilter === dept ? 'bg-[#0144D8] text-white' : 'bg-white border border-slate-200 text-slate-700'
            }`}
          >
            {dept}
          </button>
        ))}
      </div>

      {/* Active & Pending Staff Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-5">Staff Member / ID</th>
                <th className="py-3 px-4">Department & Role</th>
                <th className="py-3 px-4">Payout Bank</th>
                <th className="py-3 px-4">Sales / Comm.</th>
                <th className="py-3 px-4">Status</th>
                {isSuperAdmin && <th className="py-3 px-5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredStaff.map((member) => {
                const repCustomers = customers.filter((c) => c.salesRepUid === member.uid).length;
                const repSales = payments
                  .filter((p) => p.salesRepUid === member.uid && p.verificationStatus === 'confirmed')
                  .reduce((s, p) => s + p.amount, 0);
                const repComm = commissions
                  .filter((c) => c.salesRepUid === member.uid)
                  .reduce((s, c) => s + c.commissionAmount, 0);

                return (
                  <tr key={member.uid} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-5">
                      <p className="font-bold text-slate-900">{member.fullName}</p>
                      <p className="text-slate-500 font-mono-tabular">
                        {member.staffCode} · {member.email}
                      </p>
                      {member.phone && <p className="text-slate-400">{member.phone}</p>}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-800">{member.department}</p>
                      <p className="text-slate-500 capitalize">
                        {member.position} · Role: {member.role.replace('_', ' ')}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular">
                      {member.bankAccountNumber ? (
                        <>
                          <p className="font-semibold text-slate-800">{member.bankName}</p>
                          <p className="text-slate-500">{member.bankAccountNumber}</p>
                        </>
                      ) : (
                        <span className="text-slate-400">Not set</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular">
                      <p className="text-slate-800">{repCustomers} cust · {formatNaira(repSales)}</p>
                      <p className="text-slate-500">Comm: {formatNaira(repComm)}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-semibold capitalize ${
                          member.employmentStatus === 'active'
                            ? 'text-emerald-700'
                            : member.employmentStatus === 'pending'
                              ? 'text-amber-700'
                              : 'text-red-700'
                        }`}
                      >
                        {member.employmentStatus}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="py-3.5 px-5 text-right space-x-2 whitespace-nowrap">
                        {member.employmentStatus === 'pending' && (
                          <button
                            onClick={() => quickStatusChange(member, 'active')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        )}
                        {member.employmentStatus === 'active' && member.role !== 'super_admin' && (
                          <button
                            onClick={() => quickStatusChange(member, 'suspended')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-300 text-amber-800 font-semibold hover:bg-amber-50"
                          >
                            <ShieldBan className="w-3.5 h-3.5" />
                            <span>Suspend</span>
                          </button>
                        )}
                        {(member.employmentStatus === 'suspended' || member.employmentStatus === 'revoked') && (
                          <button
                            onClick={() => quickStatusChange(member, 'active')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-300 text-emerald-800 font-semibold hover:bg-emerald-50"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Reactivate</span>
                          </button>
                        )}
                        <button
                          onClick={() => openEditStaff(member)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                        >
                          Manage
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Staff Invites */}
      {isSuperAdmin && staffInvites.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h3 className="text-xs font-bold text-slate-800">Staff Invitations ({staffInvites.length})</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {staffInvites.map((inv) => (
              <div key={inv.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-slate-900">
                    {inv.fullName} · <span className="font-mono-tabular text-[#0144D8]">{inv.staffCode}</span>
                  </p>
                  <p className="text-slate-500">
                    {inv.email} · {inv.department} ({inv.position}) · Role: {inv.role} · {inv.status} · Invited {formatDate(inv.createdAt)}
                  </p>
                </div>
                {inv.status === 'invited' && (
                  <button
                    onClick={() => revokeStaffInvite(inv.id)}
                    className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 font-semibold hover:bg-red-50"
                  >
                    Revoke Invite
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Staff Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Invite / Pre-Authorize Staff Account</h3>
                <p className="text-xs text-slate-500">Generates a unique Staff ID and activates automatically on Google sign-in.</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    required
                    value={inviteForm.fullName}
                    onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Google Email *</label>
                  <input
                    required
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    value={inviteForm.phone}
                    onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department *</label>
                  <select
                    value={inviteForm.department}
                    onChange={(e) => setInviteForm({ ...inviteForm, department: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {settings.departments.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Position *</label>
                  <input
                    required
                    value={inviteForm.position}
                    onChange={(e) => setInviteForm({ ...inviteForm, position: e.target.value })}
                    placeholder="e.g. Senior Sales Executive"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Permission Role *</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as Exclude<StaffRole, 'super_admin'> })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="sales">Sales & Marketing</option>
                    <option value="developer">Developer</option>
                    <option value="finance">Finance</option>
                    <option value="support">Customer Support</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name</label>
                  <input
                    value={inviteForm.bankName}
                    onChange={(e) => setInviteForm({ ...inviteForm, bankName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Account Number</label>
                  <input
                    value={inviteForm.bankAccountNumber}
                    onChange={(e) => setInviteForm({ ...inviteForm, bankAccountNumber: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
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
                  <span>{saving ? 'Creating...' : 'Create Staff Invite'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Staff Role & Access Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Manage Staff Access</h3>
                <p className="text-xs text-slate-500">{editingStaff.fullName} · {editingStaff.staffCode}</p>
              </div>
              <button onClick={() => setEditingStaff(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateStaff} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employment Status</label>
                <select
                  value={editForm.employmentStatus}
                  onChange={(e) => setEditForm({ ...editForm, employmentStatus: e.target.value as EmploymentStatus })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role & Permissions</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as StaffRole })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="sales">Sales Representative</option>
                  <option value="developer">Developer</option>
                  <option value="finance">Finance</option>
                  <option value="support">Customer Support</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <select
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  {settings.departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Position</label>
                <input
                  value={editForm.position}
                  onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Commission Rate Override % (Leave blank for company default)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={editForm.commissionRateOverride}
                  onChange={(e) => setEditForm({ ...editForm, commissionRateOverride: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular"
                />
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
                <KeyRound className="w-4 h-4 text-[#0144D8] shrink-0 mt-0.5" />
                <span>
                  Staff sign in using Google Workspace authentication. Revoking or suspending immediately blocks all Firestore & VISARA access.
                </span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6]"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
