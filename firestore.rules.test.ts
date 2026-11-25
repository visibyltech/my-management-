/**
 * VISIBYL Technologies — Firestore Security Rules Verification Spec
 * Maps the 12 adversarial "Dirty Dozen" payloads against the Eight Pillars.
 */

export interface AdversarialCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  actorRole: 'unauthenticated' | 'sales' | 'developer' | 'customer' | 'admin' | 'unverified_email';
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: AdversarialCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Customer List',
    operation: 'list',
    path: '/customers',
    actorRole: 'unauthenticated',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Self-Privilege Escalation on Staff Creation',
    operation: 'create',
    path: '/staff/attackerUid',
    actorRole: 'sales',
    payload: {
      uid: 'attackerUid',
      staffCode: 'VSB-STF-9999',
      fullName: 'Attacker',
      email: 'attacker@example.com',
      department: 'Administration',
      position: 'Boss',
      role: 'super_admin',
      employmentStatus: 'active',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Admin Write',
    operation: 'update',
    path: '/settings/company',
    actorRole: 'unverified_email',
    payload: { bankAccountNumber: '0000000000' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Staff Bank Details Tampering',
    operation: 'update',
    path: '/settings/company',
    actorRole: 'sales',
    payload: { bankAccountNumber: '1234567890' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Developer Financial Snooping',
    operation: 'get',
    path: '/projectFinancials/proj_1',
    actorRole: 'developer',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Developer Unassigned Project Access',
    operation: 'get',
    path: '/projects/unassigned_proj',
    actorRole: 'developer',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Auto-Confirmed Payment Fraud',
    operation: 'create',
    path: '/payments/pay_fraud',
    actorRole: 'sales',
    payload: {
      id: 'pay_fraud',
      receiptNumber: 'VSB-PAY-9999',
      projectId: 'proj_1',
      customerId: 'cust_1',
      customerName: 'Acme Ltd',
      salesRepUid: 'salesUid',
      amount: 100000,
      paymentMethod: 'Bank Transfer (Kuda)',
      paymentDate: '2026-11-25',
      transactionReference: 'TX-FRAUD',
      verificationStatus: 'confirmed',
      recordedByUid: 'salesUid',
      recordedByName: 'Sales User',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Financial Record Deletion Attempt',
    operation: 'delete',
    path: '/payments/pay_1',
    actorRole: 'admin',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Shadow Field Injection on Customer Update',
    operation: 'update',
    path: '/customers/cust_1',
    actorRole: 'sales',
    payload: { isShadowBypass: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'ID Poisoning on Project Creation',
    operation: 'create',
    path: '/projects/bad..id$poison',
    actorRole: 'admin',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Customer Cross-Tenant Onboarding Read',
    operation: 'get',
    path: '/onboardingForms/form_other_customer',
    actorRole: 'customer',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Activity Log Tampering',
    operation: 'delete',
    path: '/activityLogs/log_1',
    actorRole: 'admin',
    expectedResult: 'PERMISSION_DENIED',
  },
];
