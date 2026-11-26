import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Send,
  Upload,
} from 'lucide-react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { db, uploadVisibylFile } from '../lib/firebase';
import { NavSection, Project, ProjectDeliverable } from '../types/visibyl';
import {
  daysUntil,
  formatDate,
  formatNaira,
  isWithinTimeframe,
  TimeframeFilter,
} from '../utils/formatters';

interface DashboardViewProps {
  onNavigate: (section: NavSection) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { firebaseUser, staffProfile, isAdmin, isFinance, isSales, isDeveloper, isSuperAdmin } = useAuth();
  const {
    customers,
    projects,
    projectFinancials,
    onboardingForms,
    payments,
    expenses,
    commissions,
    staffPublic,
    updateProjectDeveloper,
    addProjectDeliverable,
  } = useData();

  const [timeframe, setTimeframe] = useState<TimeframeFilter>('monthly');

  // Developer-specific state
  const [selectedDevProject, setSelectedDevProject] = useState<Project | null>(null);
  const [devStatus, setDevStatus] = useState<'In Progress' | 'Under Review' | 'Awaiting Information'>('In Progress');
  const [devProgress, setDevProgress] = useState<number>(0);
  const [devNotes, setDevNotes] = useState<string>('');
  const [devSaving, setDevSaving] = useState(false);
  const [deliverables, setDeliverables] = useState<ProjectDeliverable[]>([]);
  const [delivTitle, setDelivTitle] = useState('');
  const [delivNotes, setDelivNotes] = useState('');
  const [delivUploading, setDelivUploading] = useState(false);
  const [devMessage, setDevMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDevProject) {
      setDeliverables([]);
      return;
    }
    setDevStatus(
      selectedDevProject.status === 'Under Review' || selectedDevProject.status === 'Awaiting Information'
        ? selectedDevProject.status
        : 'In Progress'
    );
    setDevProgress(selectedDevProject.progressPercent || 0);
    setDevNotes(selectedDevProject.developerNotes || '');

    const q = query(
      collection(db, 'projects', selectedDevProject.id, 'deliverables'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setDeliverables(snap.docs.map((d) => d.data() as ProjectDeliverable));
    });
    return () => unsub();
  }, [selectedDevProject]);

  // Financial & Operational Aggregations (Strict: only confirmed payments count toward revenue)
  const metrics = useMemo(() => {
    const activeProjectsCount = projects.filter(
      (p) => !['Completed', 'Cancelled'].includes(p.status)
    ).length;
    const completedProjectsCount = projects.filter((p) => p.status === 'Completed').length;

    const confirmedPaymentsAll = payments.filter((p) => p.verificationStatus === 'confirmed');
    const pendingPayments = payments.filter((p) => p.verificationStatus === 'pending');

    const totalConfirmedRevenue = confirmedPaymentsAll.reduce((sum, p) => sum + p.amount, 0);
    const periodRevenue = confirmedPaymentsAll
      .filter((p) => isWithinTimeframe(p.paymentDate || p.createdAt, timeframe))
      .reduce((sum, p) => sum + p.amount, 0);

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const periodExpenses = expenses
      .filter((e) => isWithinTimeframe(e.expenseDate || e.createdAt, timeframe))
      .reduce((sum, e) => sum + e.amount, 0);

    let totalOutstanding = 0;
    projectFinancials.forEach((fin) => {
      totalOutstanding += Number(fin.outstandingBalance || 0);
    });

    const activeStaffCount = staffPublic.filter((s) => s.employmentStatus === 'active').length;

    return {
      totalCustomers: customers.length,
      totalEmployees: activeStaffCount,
      activeProjectsCount,
      completedProjectsCount,
      totalConfirmedRevenue,
      periodRevenue,
      totalOutstanding,
      totalExpenses,
      periodExpenses,
      netIncomeAll: totalConfirmedRevenue - totalExpenses,
      periodNetIncome: periodRevenue - periodExpenses,
      pendingVerificationCount: pendingPayments.length,
      pendingVerificationAmount: pendingPayments.reduce((s, p) => s + p.amount, 0),
    };
  }, [customers, projects, projectFinancials, payments, expenses, staffPublic, timeframe]);

  const approachingDeadlines = useMemo(() => {
    return projects
      .filter((p) => !['Completed', 'Cancelled'].includes(p.status))
      .map((p) => ({ project: p, days: daysUntil(p.deadline) }))
      .filter((item) => item.days !== null && item.days <= 7)
      .sort((a, b) => (a.days ?? 99) - (b.days ?? 99));
  }, [projects]);

  const staffPerformance = useMemo(() => {
    const map = new Map<
      string,
      { uid: string; name: string; customers: number; confirmedSales: number; commissionEarned: number }
    >();
    customers.forEach((c) => {
      if (!c.salesRepUid) return;
      const entry = map.get(c.salesRepUid) || {
        uid: c.salesRepUid,
        name: c.salesRepName,
        customers: 0,
        confirmedSales: 0,
        commissionEarned: 0,
      };
      entry.customers += 1;
      map.set(c.salesRepUid, entry);
    });
    payments
      .filter((p) => p.verificationStatus === 'confirmed')
      .forEach((p) => {
        if (!p.salesRepUid) return;
        const entry = map.get(p.salesRepUid) || {
          uid: p.salesRepUid,
          name: 'Sales Rep',
          customers: 0,
          confirmedSales: 0,
          commissionEarned: 0,
        };
        entry.confirmedSales += p.amount;
        map.set(p.salesRepUid, entry);
      });
    commissions.forEach((cm) => {
      const entry = map.get(cm.salesRepUid) || {
        uid: cm.salesRepUid,
        name: cm.salesRepName,
        customers: 0,
        confirmedSales: 0,
        commissionEarned: 0,
      };
      entry.commissionEarned += cm.commissionAmount;
      map.set(cm.salesRepUid, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.confirmedSales - a.confirmedSales);
  }, [customers, payments, commissions]);

  // ===================
  // DEVELOPER DASHBOARD (No Confidential Financials)
  // ===================
  if (isDeveloper) {
    const devProjects = projects;
    const activeDev = devProjects.filter((p) => !['Completed', 'Cancelled'].includes(p.status)).length;
    const reviewDev = devProjects.filter((p) => p.status === 'Under Review').length;
    const completedDev = devProjects.filter((p) => p.status === 'Completed').length;

    const linkedOnboarding = selectedDevProject
      ? onboardingForms.find(
          (f) => f.projectId === selectedDevProject.id || f.customerId === selectedDevProject.customerId
        )
      : null;

    const handleSaveDevProgress = async (notifyReview = false) => {
      if (!selectedDevProject) return;
      setDevSaving(true);
      setDevMessage(null);
      try {
        await updateProjectDeveloper(selectedDevProject.id, {
          status: notifyReview ? 'Under Review' : devStatus,
          progressPercent: notifyReview ? 100 : devProgress,
          developerNotes: devNotes,
          notifyReadyForReview: notifyReview,
        });
        setDevMessage(
          notifyReview
            ? 'Admin notified: project marked Under Review.'
            : 'Progress and developer notes saved.'
        );
      } finally {
        setDevSaving(false);
      }
    };

    const handleUploadDeliverable = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedDevProject) return;
      setDelivUploading(true);
      setDevMessage(null);
      try {
        const res = await uploadVisibylFile(`deliverables/${selectedDevProject.id}`, file);
        await addProjectDeliverable(selectedDevProject.id, {
          title: delivTitle.trim() || file.name,
          fileName: res.name,
          fileUrl: res.url,
          notes: delivNotes,
        });
        setDelivTitle('');
        setDelivNotes('');
        setDevMessage('Deliverable uploaded and Admin notified.');
      } catch (err) {
        setDevMessage(err instanceof Error ? err.message : 'Deliverable upload failed.');
      } finally {
        setDelivUploading(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <p className="text-xs font-semibold text-[#0144D8]">Developer Workspace</p>
          <h2 className="text-xl font-bold text-slate-900 mt-1">
            Welcome back, {staffProfile?.fullName || firebaseUser?.displayName}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Review assigned project briefs, client onboarding uploads, update build progress, and submit deliverables for Admin review.
          </p>

          <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-500">Assigned Active</p>
              <p className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1">{activeDev}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Under Review</p>
              <p className="text-2xl font-bold font-mono-tabular text-[#0144D8] mt-1">{reviewDev}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Completed</p>
              <p className="text-2xl font-bold font-mono-tabular text-emerald-700 mt-1">{completedDev}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Assigned Projects List */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Your Assigned Projects</h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
              {devProjects.length === 0 ? (
                <p className="p-6 text-sm text-slate-500 text-center">No projects assigned to you yet.</p>
              ) : (
                devProjects.map((p) => {
                  const selected = selectedDevProject?.id === p.id;
                  const dueDays = daysUntil(p.deadline);
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedDevProject(p)}
                      className={`w-full text-left p-4 transition-colors ${
                        selected ? 'bg-[#F0F5FF]' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="font-mono-tabular font-semibold text-[#0144D8]">{p.projectCode}</span>
                        <span>{p.status}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 mt-1">{p.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{p.customerBusinessName} · {p.serviceType}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-mono-tabular">
                        <span>Due: {formatDate(p.deadline)}</span>
                        <span className={dueDays !== null && dueDays <= 3 ? 'text-red-600 font-semibold' : ''}>
                          {p.progressPercent}% complete
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Selected Project Workspace */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6">
            {!selectedDevProject ? (
              <div className="h-full flex flex-col items-center justify-center py-16 text-center text-slate-500">
                <FileText className="w-8 h-8 text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-slate-700">Select an assigned project</p>
                <p className="text-xs mt-1 max-w-xs">
                  View client onboarding requirements, logos, uploaded assets, and submit completed work for review.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200">
                  <div>
                    <p className="text-xs font-mono-tabular font-semibold text-[#0144D8]">
                      {selectedDevProject.projectCode} · {selectedDevProject.serviceType}
                    </p>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5">{selectedDevProject.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Client: {selectedDevProject.customerBusinessName} · Deadline: {formatDate(selectedDevProject.deadline)}
                    </p>
                  </div>
                </div>

                {devMessage && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                    {devMessage}
                  </div>
                )}

                {selectedDevProject.description && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 mb-1">Project Brief</h4>
                    <p className="text-sm text-slate-600 whitespace-pre-line bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      {selectedDevProject.description}
                    </p>
                  </div>
                )}

                {/* Linked Client Onboarding Submission */}
                {linkedOnboarding && (
                  <div className="p-4 rounded-xl border border-blue-100 bg-[#F0F5FF] space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[#0144D8]">
                        Submitted Client Onboarding ({linkedOnboarding.formCode} · {linkedOnboarding.status})
                      </h4>
                    </div>
                    {linkedOnboarding.businessDescription && (
                      <p className="text-xs text-slate-700">
                        <strong>Business:</strong> {linkedOnboarding.businessDescription}
                      </p>
                    )}
                    {linkedOnboarding.requirementsDescription && (
                      <p className="text-xs text-slate-700">
                        <strong>Expectations:</strong> {linkedOnboarding.requirementsDescription}
                      </p>
                    )}
                    {linkedOnboarding.logoUrl && (
                      <div className="flex items-center gap-3">
                        <img src={linkedOnboarding.logoUrl} alt="Client Logo" className="h-10 w-10 object-contain rounded bg-white p-1 border border-slate-200" />
                        <a href={linkedOnboarding.logoUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#0144D8] inline-flex items-center gap-1 hover:underline">
                          <span>Client Logo</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    {linkedOnboarding.attachmentUrls && linkedOnboarding.attachmentUrls.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {linkedOnboarding.attachmentUrls.map((att, idx) => (
                          <a
                            key={idx}
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:text-[#0144D8]"
                          >
                            <span>{att.name}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Progress & Status Update */}
                <div className="space-y-4 pt-2 border-t border-slate-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Project Status</label>
                      <select
                        value={devStatus}
                        onChange={(e) => setDevStatus(e.target.value as typeof devStatus)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                      >
                        <option value="Awaiting Information">Awaiting Information</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Under Review">Under Review</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Progress ({devProgress}%)
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={devProgress}
                        onChange={(e) => setDevProgress(Number(e.target.value))}
                        className="w-full accent-[#0144D8] mt-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Developer Notes</label>
                    <textarea
                      rows={3}
                      value={devNotes}
                      onChange={(e) => setDevNotes(e.target.value)}
                      placeholder="Log milestones, staging URLs, blockers, or technical notes for Admin..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => handleSaveDevProgress(false)}
                      disabled={devSaving}
                      className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50"
                    >
                      Save Progress
                    </button>
                    <button
                      onClick={() => handleSaveDevProgress(true)}
                      disabled={devSaving}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0144D8] text-white text-xs font-semibold hover:bg-[#0133A6]"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Notify Admin Ready for Review</span>
                    </button>
                  </div>
                </div>

                {/* Upload Completed Work Deliverables */}
                <div className="space-y-3 pt-4 border-t border-slate-200">
                  <h4 className="text-xs font-bold text-slate-800">Completed Work & Deliverables</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      value={delivTitle}
                      onChange={(e) => setDelivTitle(e.target.value)}
                      placeholder="Deliverable title (e.g. Production Build v1)"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    />
                    <label className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[#0144D8] bg-[#F0F5FF] text-xs font-semibold text-[#0144D8] cursor-pointer hover:bg-blue-100/70">
                      <Upload className="w-4 h-4" />
                      <span>{delivUploading ? 'Uploading...' : 'Upload Deliverable File'}</span>
                      <input type="file" onChange={handleUploadDeliverable} className="hidden" />
                    </label>
                  </div>
                  {deliverables.length > 0 && (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                      {deliverables.map((d) => (
                        <div key={d.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                          <div>
                            <p className="font-semibold text-slate-900">{d.title}</p>
                            <p className="text-slate-500">{formatDate(d.createdAt)} · {d.uploadedByName}</p>
                          </div>
                          <a
                            href={d.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-[#0144D8] hover:underline"
                          >
                            <span>Download</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===================
  // SUPER ADMIN / ADMIN / FINANCE / SALES DASHBOARD
  // ===================
  const myCommissions = commissions.filter((c) => !isSales || c.salesRepUid === firebaseUser?.uid);
  const commissionEarned = myCommissions.reduce((s, c) => s + c.commissionAmount, 0);
  const commissionPaid = myCommissions
    .filter((c) => c.payoutStatus === 'paid')
    .reduce((s, c) => s + c.commissionAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header Row & Timeframe Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {isAdmin || isFinance ? 'Executive Operations & Financial Overview' : 'Sales & Client Performance'}
          </h2>
        </div>
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          {(['daily', 'weekly', 'monthly', 'yearly', 'all'] as TimeframeFilter[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors whitespace-nowrap ${
                timeframe === tf ? 'bg-white text-[#0144D8] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tf === 'all' ? 'All Time' : tf}
            </button>
          ))}
        </div>
      </div>

      {/* Primary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Confirmed Revenue ({timeframe === 'all' ? 'Total' : timeframe})</p>
          <p className="text-2xl font-bold font-mono-tabular text-[#0144D8] mt-1.5">
            {formatNaira(metrics.periodRevenue)}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-mono-tabular">
            All-time: {formatNaira(metrics.totalConfirmedRevenue)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Outstanding Balances</p>
          <p className="text-2xl font-bold font-mono-tabular text-amber-700 mt-1.5">
            {formatNaira(metrics.totalOutstanding)}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-mono-tabular">
            Pending verification: {formatNaira(metrics.pendingVerificationAmount)}
          </p>
        </div>

        {isAdmin || isFinance ? (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Total Expenses ({timeframe === 'all' ? 'Total' : timeframe})</p>
              <p className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1.5">
                {formatNaira(metrics.periodExpenses)}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono-tabular">
                All-time: {formatNaira(metrics.totalExpenses)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Net Income ({timeframe === 'all' ? 'Total' : timeframe})</p>
              <p
                className={`text-2xl font-bold font-mono-tabular mt-1.5 ${
                  metrics.periodNetIncome >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {formatNaira(metrics.periodNetIncome)}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono-tabular">
                All-time: {formatNaira(metrics.netIncomeAll)}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Commission Earned</p>
              <p className="text-2xl font-bold font-mono-tabular text-emerald-700 mt-1.5">
                {formatNaira(commissionEarned)}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono-tabular">
                Paid: {formatNaira(commissionPaid)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500">Outstanding Commission</p>
              <p className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1.5">
                {formatNaira(Math.max(0, commissionEarned - commissionPaid))}
              </p>
              <p className="text-xs text-slate-500 mt-1">Based on confirmed payments</p>
            </div>
          </>
        )}
      </div>

      {/* Operational Counts Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => onNavigate('customers')}
          className="text-left bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-[#0144D8] transition-colors"
        >
          <p className="text-xs text-slate-500">Total Customers</p>
          <p className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">{metrics.totalCustomers}</p>
        </button>
        {isSuperAdmin && (
          <button
            onClick={() => onNavigate('staff')}
            className="text-left bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-[#0144D8] transition-colors"
          >
            <p className="text-xs text-slate-500">Active Employees</p>
            <p className="text-xl font-bold font-mono-tabular text-slate-900 mt-1">{metrics.totalEmployees}</p>
          </button>
        )}
        <button
          onClick={() => onNavigate('projects')}
          className="text-left bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-[#0144D8] transition-colors"
        >
          <p className="text-xs text-slate-500">Active Projects</p>
          <p className="text-xl font-bold font-mono-tabular text-[#0144D8] mt-1">{metrics.activeProjectsCount}</p>
        </button>
        <button
          onClick={() => onNavigate('projects')}
          className="text-left bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-[#0144D8] transition-colors"
        >
          <p className="text-xs text-slate-500">Completed Projects</p>
          <p className="text-xl font-bold font-mono-tabular text-emerald-700 mt-1">{metrics.completedProjectsCount}</p>
        </button>
      </div>

      {/* Action Alerts (Pending Payment Verifications & Approaching Deadlines) */}
      {(metrics.pendingVerificationCount > 0 || approachingDeadlines.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {metrics.pendingVerificationCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-950">
                    {metrics.pendingVerificationCount} Payment{metrics.pendingVerificationCount > 1 ? 's' : ''} Pending Admin Verification
                  </p>
                  <p className="text-xs text-amber-800 mt-0.5 font-mono-tabular">
                    Total unconfirmed transfers: {formatNaira(metrics.pendingVerificationAmount)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('payments')}
                className="px-3.5 py-2 rounded-lg bg-amber-900 text-white text-xs font-semibold hover:bg-amber-950 whitespace-nowrap"
              >
                Review
              </button>
            </div>
          )}

          {approachingDeadlines.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#0144D8] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {approachingDeadlines.length} Project{approachingDeadlines.length > 1 ? 's' : ''} Near Deadline
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Next due: {approachingDeadlines[0].project.title} ({formatDate(approachingDeadlines[0].project.deadline)})
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('projects')}
                className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                View Projects
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bottom 2-Column Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Recent Transactions</h3>
            <button
              onClick={() => onNavigate('payments')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0144D8] hover:underline"
            >
              <span>All Payments</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {payments.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No payment transactions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500">
                    <th className="py-2.5 px-5">Receipt / Customer</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {payments.slice(0, 8).map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5">
                        <p className="font-semibold text-slate-900">{p.customerName}</p>
                        <p className="text-slate-500 font-mono-tabular">{p.receiptNumber} · {p.transactionReference}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono-tabular">{formatDate(p.paymentDate)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold capitalize ${
                            p.verificationStatus === 'confirmed'
                              ? 'text-emerald-700'
                              : p.verificationStatus === 'rejected'
                                ? 'text-red-700'
                                : 'text-amber-700'
                          }`}
                        >
                          {p.verificationStatus === 'confirmed' && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />}
                          {p.verificationStatus}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-right font-bold font-mono-tabular text-slate-900">
                        {formatNaira(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Staff Sales & Commission Performance */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Staff Sales Performance</h3>
            <button
              onClick={() => onNavigate('commissions')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0144D8] hover:underline"
            >
              <span>Commissions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {staffPerformance.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Sales performance metrics will populate as customers and payments are registered.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {staffPerformance.slice(0, 6).map((rep) => (
                <div key={rep.uid} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{rep.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-mono-tabular">
                      {rep.customers} customer{rep.customers === 1 ? '' : 's'} · Comm: {formatNaira(rep.commissionEarned)}
                    </p>
                  </div>
                  <p className="text-xs font-bold font-mono-tabular text-[#0144D8] shrink-0">
                    {formatNaira(rep.confirmedSales)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
