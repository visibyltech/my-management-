export type StaffRole = 'super_admin' | 'admin' | 'sales' | 'developer' | 'finance' | 'support';
export type EmploymentStatus = 'pending' | 'active' | 'suspended' | 'revoked';
export type ProjectStatus =
  | 'Pending'
  | 'Awaiting Information'
  | 'In Progress'
  | 'Under Review'
  | 'Completed'
  | 'Cancelled';
export type PaymentVerificationStatus = 'pending' | 'confirmed' | 'rejected';
export type CommissionPayoutStatus = 'unpaid' | 'approved' | 'paid';
export type InvoiceStatus = 'Unpaid' | 'Partially Paid' | 'Paid' | 'Overdue';
export type OnboardingStatus = 'Pending' | 'Submitted' | 'Reviewed';

export type NavSection =
  | 'dashboard'
  | 'customers'
  | 'staff'
  | 'projects'
  | 'onboarding'
  | 'invoices'
  | 'payments'
  | 'commissions'
  | 'expenses'
  | 'reports'
  | 'settings';

export interface CompanySettings {
  companyName: string;
  tagline: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  bankAccountName: string;
  bankName: string;
  bankAccountNumber: string;
  minimumPaymentAmount: number;
  commissionMode: 'percentage' | 'fixed';
  defaultCommissionRate: number;
  defaultFixedCommission: number;
  departments: string[];
  services: string[];
  updatedByUid: string;
  updatedAt: string;
}

export interface StaffMember {
  uid: string;
  staffCode: string;
  fullName: string;
  email: string;
  phone?: string;
  department: string;
  position: string;
  role: StaffRole;
  employmentStatus: EmploymentStatus;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  commissionRateOverride?: number;
  inviteId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffPublic {
  uid: string;
  staffCode: string;
  fullName: string;
  department: string;
  position: string;
  role: StaffRole;
  employmentStatus: EmploymentStatus;
  updatedAt: string;
}

export interface StaffInvite {
  id: string;
  staffCode: string;
  fullName: string;
  email: string;
  phone?: string;
  department: string;
  position: string;
  role: Exclude<StaffRole, 'super_admin'>;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  status: 'invited' | 'claimed' | 'revoked';
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  customerCode: string;
  accountNumber: string;
  fullName: string;
  businessName: string;
  phone: string;
  email: string;
  businessAddress: string;
  businessCategory?: string;
  registrationDate: string;
  salesRepUid: string;
  salesRepName: string;
  notes?: string;
  customerUid?: string;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  projectCode: string;
  title: string;
  serviceType: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  customerBusinessName: string;
  salesRepUid: string;
  salesRepName: string;
  developerUid?: string;
  developerName?: string;
  status: ProjectStatus;
  progressPercent: number;
  startDate: string;
  deadline: string;
  description?: string;
  developerNotes?: string;
  readyForReviewAt?: string;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFinancial {
  projectId: string;
  customerId: string;
  customerEmail?: string;
  salesRepUid: string;
  agreedPrice: number;
  totalPaid: number;
  outstandingBalance: number;
  paymentStatus: 'Unpaid' | 'Partially Paid' | 'Fully Paid';
  updatedAt: string;
}

export interface ProjectDeliverable {
  id: string;
  projectId: string;
  title: string;
  fileName?: string;
  fileUrl: string;
  notes?: string;
  uploadedByUid: string;
  uploadedByName: string;
  createdAt: string;
}

export interface UploadedAttachment {
  name: string;
  url: string;
  type: string;
}

export interface OnboardingForm {
  id: string;
  formCode: string;
  customerId: string;
  customerCode?: string;
  customerEmail: string;
  projectId?: string;
  salesRepUid: string;
  developerUid?: string;
  status: OnboardingStatus;
  fullName?: string;
  businessName?: string;
  phone?: string;
  email?: string;
  businessAddress?: string;
  businessCategory?: string;
  servicePurchased: string;
  businessDescription?: string;
  requirementsDescription?: string;
  serviceSpecificAnswers?: Record<string, string>;
  logoUrl?: string;
  attachmentUrls?: UploadedAttachment[];
  submittedByUid?: string;
  submittedAt?: string;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerCode?: string;
  customerName: string;
  customerBusinessName?: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  projectId?: string;
  projectCode?: string;
  salesRepUid: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceLineItem[];
  totalAmount: number;
  amountPaid: number;
  outstandingBalance: number;
  status: InvoiceStatus;
  notes?: string;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  receiptNumber: string;
  projectId: string;
  projectCode?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  salesRepUid: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  transactionReference: string;
  notes?: string;
  verificationStatus: PaymentVerificationStatus;
  recordedByUid: string;
  recordedByName: string;
  verifiedByUid?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Commission {
  id: string;
  salesRepUid: string;
  salesRepName: string;
  customerId: string;
  customerName?: string;
  projectId: string;
  projectCode?: string;
  paymentId: string;
  confirmedPaymentAmount: number;
  commissionType: 'percentage' | 'fixed';
  commissionRate: number;
  commissionAmount: number;
  payoutStatus: CommissionPayoutStatus;
  payoutReference?: string;
  approvedByUid?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  expenseCode: string;
  description: string;
  category: string;
  amount: number;
  expenseDate: string;
  paymentMethod: string;
  responsiblePerson: string;
  receiptUrl?: string;
  receiptName?: string;
  recordedByUid: string;
  recordedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  targetRole: 'admins' | 'staff' | 'user';
  targetUid?: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  createdByUid: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
}
