import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  Unsubscribe,
  where,
  writeBatch,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from './AuthContext';
import {
  ActivityLog,
  AppNotification,
  Commission,
  CompanySettings,
  Customer,
  Expense,
  Invoice,
  InvoiceLineItem,
  OnboardingForm,
  Payment,
  Project,
  ProjectDeliverable,
  ProjectFinancial,
  ProjectStatus,
  StaffInvite,
  StaffMember,
  StaffPublic,
  StaffRole,
  EmploymentStatus,
  UploadedAttachment,
} from '../types/visibyl';
import {
  DEFAULT_DEPARTMENTS,
  DEFAULT_SERVICES,
  generateCustomerAccountNumber,
  generateCustomerCode,
  generateExpenseCode,
  generateInvoiceNumber,
  generateOnboardingCode,
  generateProjectCode,
  generateReceiptNumber,
  generateStaffCode,
  makeDocId,
  todayISO,
} from '../utils/formatters';

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: 'VISIBYL Technologies',
  tagline: 'From unseen to unforgettable.',
  companyEmail: 'hello@visibyltechnologies.com',
  companyPhone: '+234 800 847 4295',
  companyAddress: 'Lagos, Nigeria',
  bankAccountName: 'Visibyl Technologies',
  bankName: 'Kuda Bank',
  bankAccountNumber: '3003411811',
  minimumPaymentAmount: 50000,
  commissionMode: 'percentage',
  defaultCommissionRate: 10,
  defaultFixedCommission: 25000,
  departments: DEFAULT_DEPARTMENTS,
  services: DEFAULT_SERVICES,
  updatedByUid: '',
  updatedAt: '',
};

interface DataContextValue {
  settings: CompanySettings;
  customers: Customer[];
  projects: Project[];
  projectFinancials: Map<string, ProjectFinancial>;
  onboardingForms: OnboardingForm[];
  invoices: Invoice[];
  payments: Payment[];
  commissions: Commission[];
  expenses: Expense[];
  staffMembers: StaffMember[];
  staffPublic: StaffPublic[];
  staffInvites: StaffInvite[];
  notifications: AppNotification[];
  activityLogs: ActivityLog[];
  loadingData: boolean;

  // Actions
  createCustomer: (input: {
    fullName: string;
    businessName: string;
    phone: string;
    email: string;
    businessAddress: string;
    businessCategory?: string;
    websiteUrl?: string;
    websiteType?: 'static' | 'automated' | 'school_management' | 'business_management' | 'cac_registration' | 'social_media_management' | 'social_media_boost' | 'other' | '';
    otherService?: string;
    dealClosedDate?: string;
    domainPurchaseDate?: string;
    agreedProjectAmount?: number;
    amountPaid?: number;
    salesRepUid?: string;
    salesRepName?: string;
    notes?: string;
  }) => Promise<Customer>;
  updateCustomer: (customerId: string, updates: Partial<Customer>) => Promise<void>;

  createProject: (input: {
    title: string;
    serviceType: string;
    customer: Customer;
    salesRepUid: string;
    salesRepName: string;
    developerUid?: string;
    developerName?: string;
    agreedPrice: number;
    startDate: string;
    deadline: string;
    description?: string;
  }) => Promise<Project>;
  updateProjectAdmin: (projectId: string, updates: Partial<Project>, newAgreedPrice?: number) => Promise<void>;
  updateProjectDeveloper: (
    projectId: string,
    updates: {
      status: 'In Progress' | 'Under Review' | 'Awaiting Information';
      progressPercent: number;
      developerNotes: string;
      notifyReadyForReview?: boolean;
    }
  ) => Promise<void>;
  addProjectDeliverable: (
    projectId: string,
    input: { title: string; fileName: string; fileUrl: string; notes?: string }
  ) => Promise<void>;

  createOnboardingForm: (input: {
    customer: Customer;
    servicePurchased: string;
    projectId?: string;
    developerUid?: string;
  }) => Promise<OnboardingForm>;
  submitOnboardingForm: (
    formId: string,
    payload: {
      fullName: string;
      businessName: string;
      phone: string;
      email: string;
      businessAddress: string;
      businessCategory: string;
      servicePurchased: string;
      businessDescription: string;
      requirementsDescription: string;
      serviceSpecificAnswers: Record<string, string>;
      logoUrl?: string;
      attachmentUrls?: UploadedAttachment[];
    }
  ) => Promise<void>;
  markOnboardingReviewed: (formId: string) => Promise<void>;

  createInvoice: (input: {
    customer: Customer;
    project?: Project;
    issueDate: string;
    dueDate: string;
    items: InvoiceLineItem[];
    amountPaid?: number;
    notes?: string;
  }) => Promise<Invoice>;

  recordPayment: (input: {
    project: Project;
    invoice?: Invoice;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    transactionReference: string;
    notes?: string;
  }) => Promise<Payment>;
  verifyPayment: (payment: Payment, decision: 'confirmed' | 'rejected') => Promise<void>;

  updateCommissionPayout: (
    commissionId: string,
    payoutStatus: 'approved' | 'paid',
    payoutReference?: string
  ) => Promise<void>;

  createExpense: (input: {
    description: string;
    category: string;
    amount: number;
    expenseDate: string;
    paymentMethod: string;
    responsiblePerson: string;
    receiptUrl?: string;
    receiptName?: string;
  }) => Promise<Expense>;

  inviteStaff: (input: {
    fullName: string;
    email: string;
    phone?: string;
    department: string;
    position: string;
    role: Exclude<StaffRole, 'super_admin'>;
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
  }) => Promise<StaffInvite>;
  updateStaffStatusAndRole: (
    uid: string,
    updates: {
      employmentStatus?: EmploymentStatus;
      role?: StaffRole;
      department?: string;
      position?: string;
      commissionRateOverride?: number;
    }
  ) => Promise<void>;
  updateOwnStaffProfile: (updates: {
    fullName: string;
    phone: string;
    bankName: string;
    bankAccountNumber: string;
    bankAccountName: string;
  }) => Promise<void>;
  revokeStaffInvite: (inviteId: string) => Promise<void>;

  updateCompanySettings: (updates: CompanySettings) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    firebaseUser,
    staffProfile,
    authReady,
    isAdmin,
    isFinance,
    isSales,
    isDeveloper,
    isSupport,
    isActiveStaff,
    isSuperAdmin,
  } = useAuth();

  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFinancials, setProjectFinancials] = useState<Map<string, ProjectFinancial>>(new Map());
  const [onboardingForms, setOnboardingForms] = useState<OnboardingForm[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffPublic, setStaffPublic] = useState<StaffPublic[]>([]);
  const [staffInvites, setStaffInvites] = useState<StaffInvite[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!authReady) return;
    if (!firebaseUser || !firebaseUser.emailVerified) {
      setCustomers([]);
      setProjects([]);
      setProjectFinancials(new Map());
      setOnboardingForms([]);
      setInvoices([]);
      setPayments([]);
      setCommissions([]);
      setExpenses([]);
      setStaffMembers([]);
      setStaffPublic([]);
      setStaffInvites([]);
      setNotifications([]);
      setActivityLogs([]);
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    const unsubs: Unsubscribe[] = [];
    const uid = firebaseUser.uid;
    const emailLower = (firebaseUser.email || '').toLowerCase().trim();

    // 1. Company Settings (all authenticated users need bank instructions on invoices/forms)
    unsubs.push(
      onSnapshot(
        doc(db, 'settings', 'company'),
        (snap) => {
          if (snap.exists()) {
            setSettings(snap.data() as CompanySettings);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'settings/company')
      )
    );

    if (!isActiveStaff) {
      // Customer-only portal access: strictly scoped by their verified email
      unsubs.push(
        onSnapshot(
          query(collection(db, 'customers'), where('email', '==', emailLower)),
          (snap) => setCustomers(snap.docs.map((d) => d.data() as Customer)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'customers')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'onboardingForms'), where('customerEmail', '==', emailLower)),
          (snap) => setOnboardingForms(snap.docs.map((d) => d.data() as OnboardingForm)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'onboardingForms')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'invoices'), where('customerEmail', '==', emailLower)),
          (snap) => setInvoices(snap.docs.map((d) => d.data() as Invoice)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'invoices')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'payments'), where('customerEmail', '==', emailLower)),
          (snap) => setPayments(snap.docs.map((d) => d.data() as Payment)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'payments')
        )
      );
      setLoadingData(false);
      return () => unsubs.forEach((u) => u());
    }

    // Active Staff Subscriptions (Role-Enforced)
    unsubs.push(
      onSnapshot(
        collection(db, 'staffPublic'),
        (snap) => setStaffPublic(snap.docs.map((d) => d.data() as StaffPublic)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'staffPublic')
      )
    );

    // Notifications
    const notifQuery = isAdmin
      ? collection(db, 'notifications')
      : query(collection(db, 'notifications'), where('targetRole', '==', 'staff'));
    unsubs.push(
      onSnapshot(
        notifQuery,
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as AppNotification)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setNotifications(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
      )
    );

    // Projects & Onboarding Forms
    if (isDeveloper) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'projects'), where('developerUid', '==', uid)),
          (snap) => setProjects(snap.docs.map((d) => d.data() as Project)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'projects')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'onboardingForms'), where('developerUid', '==', uid)),
          (snap) => setOnboardingForms(snap.docs.map((d) => d.data() as OnboardingForm)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'onboardingForms')
        )
      );
      setLoadingData(false);
      return () => unsubs.forEach((u) => u());
    }

    // Non-Developer Staff (Admin, Finance, Sales, Support)
    const custQ =
      isAdmin || isFinance || isSupport
        ? collection(db, 'customers')
        : query(collection(db, 'customers'), where('salesRepUid', '==', uid));
    unsubs.push(
      onSnapshot(
        custQ,
        (snap) =>
          setCustomers(
            snap.docs
              .map((d) => d.data() as Customer)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          ),
        (err) => handleFirestoreError(err, OperationType.LIST, 'customers')
      )
    );

    const projQ =
      isAdmin || isFinance || isSupport
        ? collection(db, 'projects')
        : query(collection(db, 'projects'), where('salesRepUid', '==', uid));
    unsubs.push(
      onSnapshot(
        projQ,
        (snap) =>
          setProjects(
            snap.docs
              .map((d) => d.data() as Project)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          ),
        (err) => handleFirestoreError(err, OperationType.LIST, 'projects')
      )
    );

    const onbQ =
      isAdmin || isSupport
        ? collection(db, 'onboardingForms')
        : query(collection(db, 'onboardingForms'), where('salesRepUid', '==', uid));
    unsubs.push(
      onSnapshot(
        onbQ,
        (snap) =>
          setOnboardingForms(
            snap.docs
              .map((d) => d.data() as OnboardingForm)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          ),
        (err) => handleFirestoreError(err, OperationType.LIST, 'onboardingForms')
      )
    );

    if (isAdmin || isFinance || isSales) {
      const finQ =
        isAdmin || isFinance
          ? collection(db, 'projectFinancials')
          : query(collection(db, 'projectFinancials'), where('salesRepUid', '==', uid));
      unsubs.push(
        onSnapshot(
          finQ,
          (snap) => {
            const m = new Map<string, ProjectFinancial>();
            snap.docs.forEach((d) => {
              const data = d.data() as ProjectFinancial;
              m.set(data.projectId, data);
            });
            setProjectFinancials(m);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'projectFinancials')
        )
      );

      const invQ =
        isAdmin || isFinance
          ? collection(db, 'invoices')
          : query(collection(db, 'invoices'), where('salesRepUid', '==', uid));
      unsubs.push(
        onSnapshot(
          invQ,
          (snap) =>
            setInvoices(
              snap.docs
                .map((d) => d.data() as Invoice)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            ),
          (err) => handleFirestoreError(err, OperationType.LIST, 'invoices')
        )
      );

      const payQ =
        isAdmin || isFinance
          ? collection(db, 'payments')
          : query(collection(db, 'payments'), where('salesRepUid', '==', uid));
      unsubs.push(
        onSnapshot(
          payQ,
          (snap) =>
            setPayments(
              snap.docs
                .map((d) => d.data() as Payment)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            ),
          (err) => handleFirestoreError(err, OperationType.LIST, 'payments')
        )
      );

      const commQ =
        isAdmin || isFinance
          ? collection(db, 'commissions')
          : query(collection(db, 'commissions'), where('salesRepUid', '==', uid));
      unsubs.push(
        onSnapshot(
          commQ,
          (snap) =>
            setCommissions(
              snap.docs
                .map((d) => d.data() as Commission)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            ),
          (err) => handleFirestoreError(err, OperationType.LIST, 'commissions')
        )
      );
    }

    if (isAdmin || isFinance) {
      unsubs.push(
        onSnapshot(
          collection(db, 'expenses'),
          (snap) =>
            setExpenses(
              snap.docs
                .map((d) => d.data() as Expense)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            ),
          (err) => handleFirestoreError(err, OperationType.LIST, 'expenses')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'staff'),
          (snap) => setStaffMembers(snap.docs.map((d) => d.data() as StaffMember)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'staff')
        )
      );
    }

    if (isSuperAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'staffInvites'),
          (snap) => setStaffInvites(snap.docs.map((d) => d.data() as StaffInvite)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'staffInvites')
        )
      );
    }

    if (isAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'activityLogs'),
          (snap) =>
            setActivityLogs(
              snap.docs
                .map((d) => d.data() as ActivityLog)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            ),
          (err) => handleFirestoreError(err, OperationType.LIST, 'activityLogs')
        )
      );
    }

    setLoadingData(false);
    return () => unsubs.forEach((u) => u());
  }, [authReady, firebaseUser, isActiveStaff, isAdmin, isFinance, isSales, isDeveloper, isSupport, isSuperAdmin]);

  const actorUid = firebaseUser?.uid || '';
  const actorName = staffProfile?.fullName || firebaseUser?.displayName || firebaseUser?.email || 'User';
  const actorRole = isSuperAdmin ? 'super_admin' : staffProfile?.role || 'customer';

  const appendLogAndNotif = (
    batch: ReturnType<typeof writeBatch>,
    log: Omit<ActivityLog, 'id' | 'actorUid' | 'actorName' | 'actorRole' | 'createdAt'>,
    notif?: Omit<AppNotification, 'id' | 'isRead' | 'createdByUid' | 'createdAt'>
  ) => {
    const now = new Date().toISOString();
    const logId = makeDocId('LOG');
    batch.set(doc(db, 'activityLogs', logId), {
      id: logId,
      actorUid,
      actorName,
      actorRole,
      ...log,
      createdAt: now,
    });
    if (notif) {
      const notifId = makeDocId('NTF');
      batch.set(doc(db, 'notifications', notifId), {
        id: notifId,
        ...notif,
        isRead: false,
        createdByUid: actorUid,
        createdAt: now,
      });
    }
  };

  const createCustomer: DataContextValue['createCustomer'] = async (input) => {
    const now = new Date().toISOString();
    const id = makeDocId('CUS');
    const customer: Customer = {
      id,
      customerCode: generateCustomerCode(),
      accountNumber: generateCustomerAccountNumber(),
      fullName: input.fullName.trim(),
      businessName: input.businessName.trim(),
      phone: input.phone.trim(),
      email: input.email.toLowerCase().trim(),
      businessAddress: input.businessAddress.trim(),
      businessCategory: input.businessCategory?.trim() || '',
      websiteUrl: input.websiteUrl?.trim() || '',
      websiteType: input.websiteType || '',
      otherService: input.otherService?.trim() || '',
      dealClosedDate: input.dealClosedDate || '',
      domainPurchaseDate: input.domainPurchaseDate || '',
      agreedProjectAmount: Math.max(0, Number(input.agreedProjectAmount || 0)),
      amountPaid: Math.max(0, Number(input.amountPaid || 0)),
      outstandingBalance: Math.max(0, Number(input.agreedProjectAmount || 0) - Number(input.amountPaid || 0)),
      registrationDate: todayISO(),
      salesRepUid: input.salesRepUid || actorUid,
      salesRepName: input.salesRepName || actorName,
      notes: input.notes?.trim() || '',
      createdByUid: actorUid,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'customers', id), customer);
      appendLogAndNotif(
        batch,
        {
          action: 'created',
          entityType: 'customer',
          entityId: id,
          summary: `Registered customer ${customer.businessName} (${customer.customerCode} · Acct ${customer.accountNumber})`,
        },
        {
          targetRole: 'admins',
          type: 'new_customer',
          title: 'New Customer Registered',
          message: `${customer.businessName} (${customer.customerCode}) was registered by ${actorName}.`,
          entityType: 'customer',
          entityId: id,
        }
      );
      await batch.commit();
      return customer;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `customers/${id}`);
    }
  };

  const updateCustomer: DataContextValue['updateCustomer'] = async (customerId, updates) => {
    const existing = customers.find((c) => c.id === customerId);
    if (!existing) throw new Error('Customer not found.');
    const now = new Date().toISOString();
    const merged: Customer = {
      ...existing,
      ...updates,
      agreedProjectAmount: Math.max(0, Number(updates.agreedProjectAmount ?? existing.agreedProjectAmount ?? 0)),
      amountPaid: Math.max(0, Number(updates.amountPaid ?? existing.amountPaid ?? 0)),
      outstandingBalance: Math.max(0, Number(updates.agreedProjectAmount ?? existing.agreedProjectAmount ?? 0) - Number(updates.amountPaid ?? existing.amountPaid ?? 0)),
      email: (updates.email ?? existing.email).toLowerCase().trim(),
      updatedAt: now,
    };
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'customers', customerId), merged);
      appendLogAndNotif(batch, {
        action: 'updated',
        entityType: 'customer',
        entityId: customerId,
        summary: `Updated customer record ${merged.businessName} (${merged.customerCode})`,
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `customers/${customerId}`);
    }
  };

  const createProject: DataContextValue['createProject'] = async (input) => {
    const now = new Date().toISOString();
    const id = makeDocId('PRJ');
    const projectCode = generateProjectCode();
    const project: Project = {
      id,
      projectCode,
      title: input.title.trim(),
      serviceType: input.serviceType,
      customerId: input.customer.id,
      customerCode: input.customer.customerCode,
      customerName: input.customer.fullName,
      customerBusinessName: input.customer.businessName,
      salesRepUid: input.salesRepUid,
      salesRepName: input.salesRepName,
      developerUid: input.developerUid || '',
      developerName: input.developerName || '',
      status: 'Pending',
      progressPercent: 0,
      startDate: input.startDate,
      deadline: input.deadline,
      description: input.description?.trim() || '',
      developerNotes: '',
      createdByUid: actorUid,
      createdAt: now,
      updatedAt: now,
    };

    const financial: ProjectFinancial = {
      projectId: id,
      customerId: input.customer.id,
      customerEmail: input.customer.email.toLowerCase().trim(),
      salesRepUid: input.salesRepUid,
      agreedPrice: Number(input.agreedPrice),
      totalPaid: 0,
      outstandingBalance: Number(input.agreedPrice),
      paymentStatus: input.agreedPrice > 0 ? 'Unpaid' : 'Fully Paid',
      updatedAt: now,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'projects', id), project);
      batch.set(doc(db, 'projectFinancials', id), financial);
      appendLogAndNotif(
        batch,
        {
          action: 'created',
          entityType: 'project',
          entityId: id,
          summary: `Created project ${project.title} (${projectCode}) for ${input.customer.businessName}`,
        },
        {
          targetRole: input.developerUid ? 'staff' : 'admins',
          targetUid: input.developerUid || undefined,
          type: 'project_update',
          title: 'New Project Created',
          message: `${project.title} (${project.serviceType}) assigned for ${input.customer.businessName}.`,
          entityType: 'project',
          entityId: id,
        }
      );
      await batch.commit();
      return project;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `projects/${id}`);
    }
  };

  const updateProjectAdmin: DataContextValue['updateProjectAdmin'] = async (
    projectId,
    updates,
    newAgreedPrice
  ) => {
    const existing = projects.find((p) => p.id === projectId);
    if (!existing) throw new Error('Project not found.');
    const now = new Date().toISOString();
    const updated: Project = { ...existing, ...updates, updatedAt: now };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'projects', projectId), updated);

      if (typeof newAgreedPrice === 'number') {
        const fin = projectFinancials.get(projectId);
        if (fin) {
          const outstanding = Math.max(0, newAgreedPrice - fin.totalPaid);
          const paymentStatus: ProjectFinancial['paymentStatus'] =
            outstanding <= 0 ? 'Fully Paid' : fin.totalPaid > 0 ? 'Partially Paid' : 'Unpaid';
          batch.set(doc(db, 'projectFinancials', projectId), {
            ...fin,
            agreedPrice: newAgreedPrice,
            outstandingBalance: outstanding,
            paymentStatus,
            updatedAt: now,
          });
        }
      }

      appendLogAndNotif(
        batch,
        {
          action: 'updated',
          entityType: 'project',
          entityId: projectId,
          summary: `Updated project ${updated.projectCode} (${updated.status}, ${updated.progressPercent}%)`,
        },
        {
          targetRole: 'staff',
          targetUid: updated.developerUid || undefined,
          type: 'project_update',
          title: 'Project Updated',
          message: `${updated.title} (${updated.projectCode}) status is now ${updated.status}.`,
          entityType: 'project',
          entityId: projectId,
        }
      );
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
    }
  };

  const updateProjectDeveloper: DataContextValue['updateProjectDeveloper'] = async (
    projectId,
    updates
  ) => {
    const existing = projects.find((p) => p.id === projectId);
    if (!existing) throw new Error('Project not found.');
    const now = new Date().toISOString();
    const updated: Project = {
      ...existing,
      status: updates.status,
      progressPercent: updates.progressPercent,
      developerNotes: updates.developerNotes,
      readyForReviewAt: updates.notifyReadyForReview ? now : existing.readyForReviewAt || '',
      updatedAt: now,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'projects', projectId), updated);
      appendLogAndNotif(
        batch,
        {
          action: 'updated',
          entityType: 'project',
          entityId: projectId,
          summary: `Developer ${actorName} updated ${updated.projectCode} to ${updated.status} (${updated.progressPercent}%)`,
        },
        {
          targetRole: 'admins',
          type: 'project_update',
          title: updates.notifyReadyForReview ? 'Project Ready for Admin Review' : 'Developer Progress Update',
          message: `${actorName} marked ${updated.title} (${updated.projectCode}) as ${updated.status} (${updated.progressPercent}%).`,
          entityType: 'project',
          entityId: projectId,
        }
      );
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
    }
  };

  const addProjectDeliverable: DataContextValue['addProjectDeliverable'] = async (
    projectId,
    input
  ) => {
    const id = makeDocId('DLV');
    const now = new Date().toISOString();
    const deliverable: ProjectDeliverable = {
      id,
      projectId,
      title: input.title.trim(),
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      notes: input.notes?.trim() || '',
      uploadedByUid: actorUid,
      uploadedByName: actorName,
      createdAt: now,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'projects', projectId, 'deliverables', id), deliverable);
      appendLogAndNotif(
        batch,
        {
          action: 'created',
          entityType: 'deliverable',
          entityId: id,
          summary: `Uploaded deliverable "${deliverable.title}" on project ${projectId}`,
        },
        {
          targetRole: 'admins',
          type: 'project_update',
          title: 'Project Deliverable Uploaded',
          message: `${actorName} uploaded "${deliverable.title}" for review.`,
          entityType: 'project',
          entityId: projectId,
        }
      );
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `projects/${projectId}/deliverables/${id}`);
    }
  };

  const createOnboardingForm: DataContextValue['createOnboardingForm'] = async (input) => {
    const now = new Date().toISOString();
    const id = makeDocId('ONB');
    const form: OnboardingForm = {
      id,
      formCode: generateOnboardingCode(),
      customerId: input.customer.id,
      customerCode: input.customer.customerCode,
      customerEmail: input.customer.email.toLowerCase().trim(),
      projectId: input.projectId || '',
      salesRepUid: input.customer.salesRepUid || actorUid,
      developerUid: input.developerUid || '',
      status: 'Pending',
      fullName: input.customer.fullName,
      businessName: input.customer.businessName,
      phone: input.customer.phone,
      email: input.customer.email,
      businessAddress: input.customer.businessAddress,
      businessCategory: input.customer.businessCategory || '',
      servicePurchased: input.servicePurchased,
      businessDescription: '',
      requirementsDescription: '',
      serviceSpecificAnswers: {},
      logoUrl: '',
      attachmentUrls: [],
      createdByUid: actorUid,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'onboardingForms', id), form);
      appendLogAndNotif(batch, {
        action: 'created',
        entityType: 'onboardingForm',
        entityId: id,
        summary: `Generated onboarding form ${form.formCode} for ${input.customer.businessName}`,
      });
      await batch.commit();
      return form;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `onboardingForms/${id}`);
    }
  };

  const submitOnboardingForm: DataContextValue['submitOnboardingForm'] = async (formId, payload) => {
    const existing = onboardingForms.find((f) => f.id === formId);
    if (!existing) throw new Error('Onboarding form not found.');
    const now = new Date().toISOString();
    const updated: OnboardingForm = {
      ...existing,
      ...payload,
      status: 'Submitted',
      submittedByUid: actorUid,
      submittedAt: now,
      updatedAt: now,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'onboardingForms', formId), updated);
      appendLogAndNotif(
        batch,
        {
          action: 'submitted',
          entityType: 'onboardingForm',
          entityId: formId,
          summary: `Customer submitted onboarding form ${existing.formCode} (${payload.businessName})`,
        },
        {
          targetRole: 'admins',
          type: 'form_submitted',
          title: 'Customer Onboarding Form Submitted',
          message: `${payload.businessName} completed onboarding form ${existing.formCode} for ${payload.servicePurchased}.`,
          entityType: 'onboardingForm',
          entityId: formId,
        }
      );
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `onboardingForms/${formId}`);
    }
  };

  const markOnboardingReviewed: DataContextValue['markOnboardingReviewed'] = async (formId) => {
    const existing = onboardingForms.find((f) => f.id === formId);
    if (!existing) return;
    const now = new Date().toISOString();
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'onboardingForms', formId), {
        ...existing,
        status: 'Reviewed',
        updatedAt: now,
      });
      appendLogAndNotif(batch, {
        action: 'updated',
        entityType: 'onboardingForm',
        entityId: formId,
        summary: `Marked onboarding form ${existing.formCode} as Reviewed`,
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `onboardingForms/${formId}`);
    }
  };

  const createInvoice: DataContextValue['createInvoice'] = async (input) => {
    const now = new Date().toISOString();
    const id = makeDocId('INV');
    const totalAmount = input.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const amountPaid = Math.max(0, Number(input.amountPaid || 0));
    const outstandingBalance = Math.max(0, totalAmount - amountPaid);
    const status: Invoice['status'] =
      outstandingBalance <= 0
        ? 'Paid'
        : amountPaid > 0
          ? 'Partially Paid'
          : input.dueDate < todayISO()
            ? 'Overdue'
            : 'Unpaid';

    const invoice: Invoice = {
      id,
      invoiceNumber: generateInvoiceNumber(),
      customerId: input.customer.id,
      customerCode: input.customer.customerCode,
      customerName: input.customer.fullName,
      customerBusinessName: input.customer.businessName,
      customerEmail: input.customer.email.toLowerCase().trim(),
      customerPhone: input.customer.phone,
      customerAddress: input.customer.businessAddress,
      projectId: input.project?.id || '',
      projectCode: input.project?.projectCode || '',
      salesRepUid: input.customer.salesRepUid || actorUid,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      items: input.items,
      totalAmount,
      amountPaid,
      outstandingBalance,
      status,
      notes: input.notes?.trim() || '',
      createdByUid: actorUid,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'invoices', id), invoice);
      appendLogAndNotif(
        batch,
        {
          action: 'created',
          entityType: 'invoice',
          entityId: id,
          summary: `Issued invoice ${invoice.invoiceNumber} for ${invoice.customerBusinessName} (₦${totalAmount.toLocaleString('en-NG')})`,
        },
        outstandingBalance > 0
          ? {
              targetRole: 'admins',
              type: 'outstanding_balance',
              title: 'New Invoice Issued',
              message: `${invoice.invoiceNumber} issued to ${invoice.customerBusinessName} with balance ₦${outstandingBalance.toLocaleString('en-NG')}.`,
              entityType: 'invoice',
              entityId: id,
            }
          : undefined
      );
      await batch.commit();
      return invoice;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `invoices/${id}`);
    }
  };

  const recordPayment: DataContextValue['recordPayment'] = async (input) => {
    const fin = projectFinancials.get(input.project.id);
    const remaining = fin ? fin.outstandingBalance : input.amount;
    const minPayment = settings.minimumPaymentAmount || 50000;

    if (input.amount <= 0) {
      throw new Error('Payment amount must be greater than ₦0.');
    }
    if (remaining >= minPayment && input.amount < minPayment && !isSuperAdmin) {
      throw new Error(
        `Minimum customer payment is ₦${minPayment.toLocaleString('en-NG')} (unless clearing a smaller remaining balance).`
      );
    }

    const now = new Date().toISOString();
    const id = makeDocId('PAY');
    const payment: Payment = {
      id,
      receiptNumber: generateReceiptNumber(),
      projectId: input.project.id,
      projectCode: input.project.projectCode,
      invoiceId: input.invoice?.id || '',
      invoiceNumber: input.invoice?.invoiceNumber || '',
      customerId: input.project.customerId,
      customerName: input.project.customerBusinessName || input.project.customerName,
      customerEmail: fin?.customerEmail || input.invoice?.customerEmail || '',
      salesRepUid: input.project.salesRepUid,
      amount: Number(input.amount),
      paymentMethod: input.paymentMethod,
      paymentDate: input.paymentDate,
      transactionReference: input.transactionReference.trim(),
      notes: input.notes?.trim() || '',
      verificationStatus: 'pending',
      recordedByUid: actorUid,
      recordedByName: actorName,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'payments', id), payment);
      appendLogAndNotif(
        batch,
        {
          action: 'created',
          entityType: 'payment',
          entityId: id,
          summary: `Recorded pending payment ${payment.receiptNumber} of ₦${payment.amount.toLocaleString('en-NG')} (Ref: ${payment.transactionReference})`,
        },
        {
          targetRole: 'admins',
          type: 'payment_recorded',
          title: 'Payment Awaiting Admin Verification',
          message: `${actorName} recorded ₦${payment.amount.toLocaleString('en-NG')} from ${payment.customerName} (Ref: ${payment.transactionReference}).`,
          entityType: 'payment',
          entityId: id,
        }
      );
      await batch.commit();
      return payment;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `payments/${id}`);
    }
  };

  const verifyPayment: DataContextValue['verifyPayment'] = async (payment, decision) => {
    const now = new Date().toISOString();
    try {
      const batch = writeBatch(db);
      const updatedPayment: Payment = {
        ...payment,
        verificationStatus: decision,
        verifiedByUid: actorUid,
        verifiedByName: actorName,
        verifiedAt: now,
        updatedAt: now,
      };
      batch.set(doc(db, 'payments', payment.id), updatedPayment);

      if (decision === 'confirmed') {
        // Update Project Financial balance & payment status
        const fin = projectFinancials.get(payment.projectId);
        if (fin) {
          const newTotalPaid = fin.totalPaid + payment.amount;
          const newBalance = Math.max(0, fin.agreedPrice - newTotalPaid);
          const newPayStatus: ProjectFinancial['paymentStatus'] =
            newBalance <= 0 ? 'Fully Paid' : newTotalPaid > 0 ? 'Partially Paid' : 'Unpaid';
          batch.set(doc(db, 'projectFinancials', payment.projectId), {
            ...fin,
            totalPaid: newTotalPaid,
            outstandingBalance: newBalance,
            paymentStatus: newPayStatus,
            updatedAt: now,
          });
        }

        // Update linked Invoice if specified
        if (payment.invoiceId) {
          const inv = invoices.find((i) => i.id === payment.invoiceId);
          if (inv) {
            const newPaid = inv.amountPaid + payment.amount;
            const newBal = Math.max(0, inv.totalAmount - newPaid);
            const newStatus: Invoice['status'] =
              newBal <= 0 ? 'Paid' : newPaid > 0 ? 'Partially Paid' : inv.status;
            batch.set(doc(db, 'invoices', inv.id), {
              ...inv,
              amountPaid: newPaid,
              outstandingBalance: newBal,
              status: newStatus,
              updatedAt: now,
            });
          }
        }

        // Auto-generate Sales Commission entry according to company rules
        const rep = staffMembers.find((s) => s.uid === payment.salesRepUid);
        const repPublic = staffPublic.find((s) => s.uid === payment.salesRepUid);
        const commissionType = settings.commissionMode || 'percentage';
        const rate =
          typeof rep?.commissionRateOverride === 'number'
            ? rep.commissionRateOverride
            : commissionType === 'percentage'
              ? settings.defaultCommissionRate
              : settings.defaultFixedCommission;
        const commissionAmount =
          commissionType === 'percentage'
            ? Math.round((payment.amount * rate) / 100)
            : rate;

        if (commissionAmount > 0 && payment.salesRepUid) {
          const commId = makeDocId('COM');
          const comm: Commission = {
            id: commId,
            salesRepUid: payment.salesRepUid,
            salesRepName: rep?.fullName || repPublic?.fullName || 'Sales Representative',
            customerId: payment.customerId,
            customerName: payment.customerName,
            projectId: payment.projectId,
            projectCode: payment.projectCode || '',
            paymentId: payment.id,
            confirmedPaymentAmount: payment.amount,
            commissionType,
            commissionRate: rate,
            commissionAmount,
            payoutStatus: 'unpaid',
            createdAt: now,
            updatedAt: now,
          };
          batch.set(doc(db, 'commissions', commId), comm);
        }
      }

      appendLogAndNotif(
        batch,
        {
          action: decision === 'confirmed' ? 'verified' : 'rejected',
          entityType: 'payment',
          entityId: payment.id,
          summary: `${decision === 'confirmed' ? 'Confirmed' : 'Rejected'} payment ${payment.receiptNumber} (₦${payment.amount.toLocaleString('en-NG')})`,
        },
        {
          targetRole: 'staff',
          targetUid: payment.recordedByUid,
          type: 'payment_verified',
          title: `Payment ${decision === 'confirmed' ? 'Confirmed' : 'Rejected'}`,
          message: `Payment ${payment.receiptNumber} of ₦${payment.amount.toLocaleString('en-NG')} for ${payment.customerName} was ${decision}.`,
          entityType: 'payment',
          entityId: payment.id,
        }
      );
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `payments/${payment.id}`);
    }
  };

  const updateCommissionPayout: DataContextValue['updateCommissionPayout'] = async (
    commissionId,
    payoutStatus,
    payoutReference
  ) => {
    const existing = commissions.find((c) => c.id === commissionId);
    if (!existing) throw new Error('Commission record not found.');
    const now = new Date().toISOString();
    const updated: Commission = {
      ...existing,
      payoutStatus,
      payoutReference: payoutReference?.trim() || existing.payoutReference || '',
      approvedByUid: actorUid,
      paidAt: payoutStatus === 'paid' ? now : existing.paidAt || '',
      updatedAt: now,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'commissions', commissionId), updated);
      appendLogAndNotif(
        batch,
        {
          action: payoutStatus === 'paid' ? 'paid' : 'approved',
          entityType: 'commission',
          entityId: commissionId,
          summary: `Marked commission ${commissionId} (₦${existing.commissionAmount.toLocaleString('en-NG')} for ${existing.salesRepName}) as ${payoutStatus}`,
        },
        {
          targetRole: 'staff',
          targetUid: existing.salesRepUid,
          type: 'commission_paid',
          title: `Commission ${payoutStatus === 'paid' ? 'Paid' : 'Approved'}`,
          message: `Your commission of ₦${existing.commissionAmount.toLocaleString('en-NG')} (${existing.projectCode || existing.projectId}) is now ${payoutStatus}.`,
          entityType: 'commission',
          entityId: commissionId,
        }
      );
      // A commission becomes a company expense only when the Super Admin records it as paid.
      // The deterministic expense ID prevents duplicate expense entries on repeat clicks.
      if (payoutStatus === 'paid' && existing.payoutStatus !== 'paid') {
        const expenseId = `EXP-COM-${commissionId}`;
        const expense: Expense = {
          id: expenseId,
          expenseCode: expenseId,
          description: `Commission payout — ${existing.salesRepName} — ${existing.projectCode || existing.projectId}`,
          category: 'Staff Commission Payout',
          amount: existing.commissionAmount,
          expenseDate: todayISO(),
          paymentMethod: 'Bank Transfer',
          responsiblePerson: existing.salesRepName,
          receiptUrl: '',
          receiptName: '',
          recordedByUid: actorUid,
          recordedByName: actorName,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(doc(db, 'expenses', expenseId), expense);
      }
      await batch.commit();

      if (payoutStatus === 'paid' && existing.payoutStatus !== 'paid' && firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          await fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ event: 'commission_paid', staffName: existing.salesRepName, staffEmail: staffMembers.find((member) => member.uid === existing.salesRepUid)?.email || '', commissionAmount: existing.commissionAmount, commissionReference: payoutReference || commissionId }),
          });
        } catch (emailError) {
          console.warn('Commission payout saved, but email notification could not be sent:', emailError);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `commissions/${commissionId}`);
    }
  };

  const createExpense: DataContextValue['createExpense'] = async (input) => {
    const now = new Date().toISOString();
    const id = makeDocId('EXP');
    const expense: Expense = {
      id,
      expenseCode: generateExpenseCode(),
      description: input.description.trim(),
      category: input.category,
      amount: Number(input.amount),
      expenseDate: input.expenseDate,
      paymentMethod: input.paymentMethod,
      responsiblePerson: input.responsiblePerson.trim(),
      receiptUrl: input.receiptUrl || '',
      receiptName: input.receiptName || '',
      recordedByUid: actorUid,
      recordedByName: actorName,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'expenses', id), expense);
      appendLogAndNotif(batch, {
        action: 'created',
        entityType: 'expense',
        entityId: id,
        summary: `Recorded expense ${expense.expenseCode}: ${expense.description} (₦${expense.amount.toLocaleString('en-NG')})`,
      });
      await batch.commit();
      return expense;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `expenses/${id}`);
    }
  };

  const inviteStaff: DataContextValue['inviteStaff'] = async (input) => {
    const now = new Date().toISOString();
    const id = makeDocId('INVSTF');
    const invite: StaffInvite = {
      id,
      staffCode: generateStaffCode(),
      fullName: input.fullName.trim(),
      email: input.email.toLowerCase().trim(),
      phone: input.phone?.trim() || '',
      department: input.department,
      position: input.position.trim(),
      role: input.role,
      bankName: input.bankName?.trim() || '',
      bankAccountNumber: input.bankAccountNumber?.trim() || '',
      bankAccountName: input.bankAccountName?.trim() || '',
      status: 'invited',
      createdByUid: actorUid,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'staffInvites', id), invite);
      appendLogAndNotif(batch, {
        action: 'created',
        entityType: 'staffInvite',
        entityId: id,
        summary: `Invited staff member ${invite.fullName} (${invite.email}) as ${invite.role} in ${invite.department}`,
      });
      await batch.commit();
      return invite;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `staffInvites/${id}`);
    }
  };

  const updateStaffStatusAndRole: DataContextValue['updateStaffStatusAndRole'] = async (
    uid,
    updates
  ) => {
    const existing = staffMembers.find((s) => s.uid === uid);
    if (!existing) throw new Error('Staff record not found.');
    const now = new Date().toISOString();
    const updated: StaffMember = { ...existing, ...updates, updatedAt: now };
    const updatedPublic: StaffPublic = {
      uid: updated.uid,
      staffCode: updated.staffCode,
      fullName: updated.fullName,
      department: updated.department,
      position: updated.position,
      role: updated.role,
      employmentStatus: updated.employmentStatus,
      updatedAt: now,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'staff', uid), updated);
      batch.set(doc(db, 'staffPublic', uid), updatedPublic);
      appendLogAndNotif(batch, {
        action: updates.employmentStatus || 'updated',
        entityType: 'staff',
        entityId: uid,
        summary: `Updated staff ${updated.fullName} (${updated.staffCode}) — Role: ${updated.role}, Status: ${updated.employmentStatus}`,
      });
      await batch.commit();

      if (updates.employmentStatus === 'active' && existing.employmentStatus !== 'active' && firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          await fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ event: 'staff_approved', staffName: updated.fullName, staffEmail: updated.email }),
          });
        } catch (emailError) {
          console.warn('Staff approval saved, but email notification could not be sent:', emailError);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `staff/${uid}`);
    }
  };

  const updateOwnStaffProfile: DataContextValue['updateOwnStaffProfile'] = async (updates) => {
    if (!staffProfile) throw new Error('No staff profile loaded.');
    const now = new Date().toISOString();
    const updated: StaffMember = {
      ...staffProfile,
      fullName: updates.fullName.trim(),
      phone: updates.phone.trim(),
      bankName: updates.bankName.trim(),
      bankAccountNumber: updates.bankAccountNumber.trim(),
      bankAccountName: updates.bankAccountName.trim(),
      updatedAt: now,
    };
    const updatedPublic: StaffPublic = {
      uid: updated.uid,
      staffCode: updated.staffCode,
      fullName: updated.fullName,
      department: updated.department,
      position: updated.position,
      role: updated.role,
      employmentStatus: updated.employmentStatus,
      updatedAt: now,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'staff', updated.uid), updated);
      batch.set(doc(db, 'staffPublic', updated.uid), updatedPublic);
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `staff/${staffProfile.uid}`);
    }
  };

  const revokeStaffInvite: DataContextValue['revokeStaffInvite'] = async (inviteId) => {
    try {
      await deleteDoc(doc(db, 'staffInvites', inviteId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `staffInvites/${inviteId}`);
    }
  };

  const updateCompanySettings: DataContextValue['updateCompanySettings'] = async (updates) => {
    const now = new Date().toISOString();
    const next: CompanySettings = {
      ...updates,
      updatedByUid: actorUid,
      updatedAt: now,
    };
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'settings', 'company'), next);
      appendLogAndNotif(batch, {
        action: 'updated',
        entityType: 'settings',
        entityId: 'company',
        summary: `Super Admin updated company settings (Bank: ${next.bankName} ${next.bankAccountNumber}, Min Payment: ₦${next.minimumPaymentAmount.toLocaleString('en-NG')})`,
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/company');
    }
  };

  const markNotificationRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
    }
  };

  const markAllNotificationsRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      unread.slice(0, 50).forEach((n) => {
        batch.update(doc(db, 'notifications', n.id), { isRead: true });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  return (
    <DataContext.Provider
      value={{
        settings,
        customers,
        projects,
        projectFinancials,
        onboardingForms,
        invoices,
        payments,
        commissions,
        expenses,
        staffMembers,
        staffPublic,
        staffInvites,
        notifications,
        activityLogs,
        loadingData,
        createCustomer,
        updateCustomer,
        createProject,
        updateProjectAdmin,
        updateProjectDeveloper,
        addProjectDeliverable,
        createOnboardingForm,
        submitOnboardingForm,
        markOnboardingReviewed,
        createInvoice,
        recordPayment,
        verifyPayment,
        updateCommissionPayout,
        createExpense,
        inviteStaff,
        updateStaffStatusAndRole,
        updateOwnStaffProfile,
        revokeStaffInvite,
        updateCompanySettings,
        markNotificationRead,
        markAllNotificationsRead,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error('useData must be used inside DataProvider');
  }
  return ctx;
}
