import React, { useMemo, useState } from 'react';
import { Briefcase, Calendar, CheckCircle2, Edit3, Plus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Project, ProjectStatus } from '../types/visibyl';
import { daysUntil, formatDate, formatNaira, todayISO } from '../utils/formatters';

const PROJECT_STATUSES: ProjectStatus[] = [
  'Pending',
  'Awaiting Information',
  'In Progress',
  'Under Review',
  'Completed',
  'Cancelled',
];

export const ProjectsView: React.FC<{ initialSelectedId?: string | null }> = ({ initialSelectedId }) => {
  const { firebaseUser, staffProfile, isAdmin, isSales, isDeveloper } = useAuth();
  const {
    projects,
    projectFinancials,
    customers,
    staffPublic,
    settings,
    createProject,
    updateProjectAdmin,
  } = useData();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(() =>
    initialSelectedId ? projects.find((p) => p.id === initialSelectedId) || null : null
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    title: '',
    serviceType: settings.services[0] || 'Website development',
    customerId: customers[0]?.id || '',
    salesRepUid: firebaseUser?.uid || '',
    developerUid: '',
    agreedPrice: '',
    startDate: todayISO(),
    deadline: '',
    description: '',
  });

  const [editForm, setEditForm] = useState({
    status: 'Pending' as ProjectStatus,
    progressPercent: 0,
    developerUid: '',
    deadline: '',
    agreedPrice: '',
    description: '',
  });

  const developers = staffPublic.filter(
    (s) => s.employmentStatus === 'active' && ['developer', 'admin', 'super_admin'].includes(s.role)
  );
  const salesReps = staffPublic.filter(
    (s) => s.employmentStatus === 'active' && ['sales', 'admin', 'super_admin'].includes(s.role)
  );

  const filteredProjects = useMemo(() => {
    if (statusFilter === 'all') return projects;
    return projects.filter((p) => p.status === statusFilter);
  }, [projects, statusFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const customer = customers.find((c) => c.id === createForm.customerId);
    if (!customer) {
      setError('Please select a customer.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const rep = salesReps.find((s) => s.uid === createForm.salesRepUid);
      const dev = developers.find((d) => d.uid === createForm.developerUid);
      const created = await createProject({
        title: createForm.title,
        serviceType: createForm.serviceType,
        customer,
        salesRepUid: createForm.salesRepUid || customer.salesRepUid || firebaseUser?.uid || '',
        salesRepName: rep?.fullName || customer.salesRepName || staffProfile?.fullName || 'VISIBYL Rep',
        developerUid: dev?.uid || '',
        developerName: dev?.fullName || '',
        agreedPrice: Number(createForm.agreedPrice || 0),
        startDate: createForm.startDate,
        deadline: createForm.deadline,
        description: createForm.description,
      });
      setShowCreateModal(false);
      setSelectedProject(created);
      setCreateForm({
        title: '',
        serviceType: settings.services[0] || 'Website development',
        customerId: customers[0]?.id || '',
        salesRepUid: firebaseUser?.uid || '',
        developerUid: '',
        agreedPrice: '',
        startDate: todayISO(),
        deadline: '',
        description: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create project.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (p: Project) => {
    const fin = projectFinancials.get(p.id);
    setSelectedProject(p);
    setEditForm({
      status: p.status,
      progressPercent: p.progressPercent,
      developerUid: p.developerUid || '',
      deadline: p.deadline,
      agreedPrice: fin ? String(fin.agreedPrice) : '',
      description: p.description || '',
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSaving(true);
    try {
      const dev = developers.find((d) => d.uid === editForm.developerUid);
      await updateProjectAdmin(
        selectedProject.id,
        {
          status: editForm.status,
          progressPercent: editForm.status === 'Completed' ? 100 : Number(editForm.progressPercent),
          developerUid: dev?.uid || '',
          developerName: dev?.fullName || '',
          deadline: editForm.deadline,
          description: editForm.description,
        },
        editForm.agreedPrice !== '' ? Number(editForm.agreedPrice) : undefined
      );
      setShowEditModal(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Projects & Services</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Track service delivery, deadlines, developer assignments, and completion progress.
          </p>
        </div>
        {(isAdmin || isSales) && (
          <button
            onClick={() => {
              setCreateForm((prev) => ({
                ...prev,
                customerId: prev.customerId || customers[0]?.id || '',
              }));
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6] whitespace-nowrap self-start"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
            statusFilter === 'all' ? 'bg-[#0144D8] text-white' : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          All ({projects.length})
        </button>
        {PROJECT_STATUSES.map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              statusFilter === st ? 'bg-[#0144D8] text-white' : 'bg-white border border-slate-200 text-slate-700'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Projects Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredProjects.length === 0 ? (
          <div className="p-10 text-center">
            <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No projects found</p>
            <p className="text-xs text-slate-500 mt-1">Create a project to link a customer, service, developer, and deadline.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-5">Project / Customer</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4">Timeline</th>
                  {!isDeveloper && <th className="py-3 px-4 text-right">Financials</th>}
                  <th className="py-3 px-4">Status</th>
                  {isAdmin && <th className="py-3 px-5 text-right">Manage</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredProjects.map((p) => {
                  const fin = !isDeveloper ? projectFinancials.get(p.id) : undefined;
                  const due = daysUntil(p.deadline);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-5">
                        <p className="font-mono-tabular font-semibold text-[#0144D8]">{p.projectCode}</p>
                        <p className="font-bold text-slate-900 mt-0.5">{p.title}</p>
                        <p className="text-slate-500">{p.customerBusinessName} ({p.customerCode})</p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">{p.serviceType}</td>
                      <td className="py-3.5 px-4">
                        <p className="text-slate-800">Sales: {p.salesRepName}</p>
                        <p className="text-slate-500">Dev: {p.developerName || 'Unassigned'}</p>
                      </td>
                      <td className="py-3.5 px-4 font-mono-tabular">
                        <p className="text-slate-700">Start: {formatDate(p.startDate)}</p>
                        <p className={due !== null && due <= 3 && p.status !== 'Completed' ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                          <Calendar className="w-3 h-3 inline mr-1" />
                          Due: {formatDate(p.deadline)}
                        </p>
                      </td>
                      {!isDeveloper && (
                        <td className="py-3.5 px-4 text-right font-mono-tabular">
                          {fin ? (
                            <>
                              <p className="font-bold text-slate-900">{formatNaira(fin.agreedPrice)}</p>
                              <p className="text-emerald-700">Paid: {formatNaira(fin.totalPaid)}</p>
                              <p className={fin.outstandingBalance > 0 ? 'text-amber-700' : 'text-emerald-700 font-semibold'}>
                                {fin.paymentStatus === 'Fully Paid' ? (
                                  <span>
                                    <CheckCircle2 className="w-3 h-3 inline mr-0.5" />
                                    Fully Paid
                                  </span>
                                ) : (
                                  `Bal: ${formatNaira(fin.outstandingBalance)}`
                                )}
                              </p>
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900">{p.status}</p>
                        <div className="w-24 h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                          <div className="h-full bg-[#0144D8]" style={{ width: `${p.progressPercent}%` }} />
                        </div>
                        <p className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">{p.progressPercent}%</p>
                      </td>
                      {isAdmin && (
                        <td className="py-3.5 px-5 text-right">
                          <button
                            onClick={() => openEdit(p)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Update</span>
                          </button>
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

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Create New Project</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer *</label>
                <select
                  required
                  value={createForm.customerId}
                  onChange={(e) => setCreateForm({ ...createForm, customerId: e.target.value })}
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Project Title *</label>
                <input
                  required
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="e.g. Corporate E-Commerce Platform & Sales Automation"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Service Type *</label>
                  <select
                    value={createForm.serviceType}
                    onChange={(e) => setCreateForm({ ...createForm, serviceType: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {settings.services.map((srv) => (
                      <option key={srv} value={srv}>{srv}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Agreed Price (₦) *</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={createForm.agreedPrice}
                    onChange={(e) => setCreateForm({ ...createForm, agreedPrice: e.target.value })}
                    placeholder="e.g. 450000"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Salesperson</label>
                  <select
                    value={createForm.salesRepUid}
                    onChange={(e) => setCreateForm({ ...createForm, salesRepUid: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {salesReps.map((s) => (
                      <option key={s.uid} value={s.uid}>{s.fullName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Developer</label>
                  <select
                    value={createForm.developerUid}
                    onChange={(e) => setCreateForm({ ...createForm, developerUid: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Assign later...</option>
                    {developers.map((d) => (
                      <option key={d.uid} value={d.uid}>{d.fullName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date *</label>
                  <input
                    required
                    type="date"
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Deadline *</label>
                  <input
                    required
                    type="date"
                    value={createForm.deadline}
                    onChange={(e) => setCreateForm({ ...createForm, deadline: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Scope & Notes</label>
                <textarea
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6]"
                >
                  {saving ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Edit Project Modal */}
      {showEditModal && selectedProject && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Update Project</h3>
                <p className="text-xs text-slate-500">{selectedProject.projectCode} · {selectedProject.title}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Project Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ProjectStatus })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  {PROJECT_STATUSES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Progress ({editForm.progressPercent}%)
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={editForm.progressPercent}
                  onChange={(e) => setEditForm({ ...editForm, progressPercent: Number(e.target.value) })}
                  className="w-full accent-[#0144D8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Developer</label>
                <select
                  value={editForm.developerUid}
                  onChange={(e) => setEditForm({ ...editForm, developerUid: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">Unassigned</option>
                  {developers.map((d) => (
                    <option key={d.uid} value={d.uid}>{d.fullName}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Deadline</label>
                  <input
                    type="date"
                    value={editForm.deadline}
                    onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Agreed Price (₦)</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.agreedPrice}
                    onChange={(e) => setEditForm({ ...editForm, agreedPrice: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-tabular"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
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
