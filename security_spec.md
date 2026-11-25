# VISIBYL Technologies — Firestore Security Specification (Phase 0)

## 1. Core Data Invariants
1. **Super Admin Authority**: Only verified `usitakatelvin@gmail.com` or an approved `super_admin` in `/staff/{uid}` may alter `/settings/company` (including Kuda Bank details `3003411811`, minimum payment amount `₦50,000`, and commission rules) or promote/revoke staff roles.
2. **No Self-Assigned Roles**: Users registering or signing in cannot assign themselves `super_admin`, `admin`, `finance`, or `active` status unless claiming a Super-Admin-created invite in `/staffInvites` matching their verified email.
3. **Developer Financial Isolation**: Developers must never read `/projectFinancials`, `/invoices`, `/payments`, `/commissions`, or `/expenses`, and can only list/read `/projects` and `/onboardingForms` where `developerUid == request.auth.uid`.
4. **Payment Verification Gate**: Non-admin staff can only create `/payments` with `verificationStatus == 'pending'`. Only verified Admin/Super Admin can confirm or reject payments.
5. **Immutable Financial Ledger**: `/payments`, `/invoices`, `/commissions`, `/expenses`, and `/activityLogs` cannot be deleted by any client (`allow delete: if false`).
6. **Customer Privacy**: Customers can only access their own `/customers`, `/invoices`, `/payments`, and `/onboardingForms` matching their verified email or UID.
7. **Strict Key & Size Boundaries**: Every document creation enforces `keys().hasAll(...)` and `keys().hasOnly(...)`, every string enforces `.size() <= MAX`, and every path ID satisfies `^[a-zA-Z0-9_\-]+$`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Customer List**: Unauthenticated client requests `list /customers` -> `PERMISSION_DENIED`.
2. **Self-Privilege Escalation**: Newly signed-in staff attempts `create /staff/{uid}` with `role: 'super_admin'` and `employmentStatus: 'active'` -> `PERMISSION_DENIED`.
3. **Spoofed Email Claim**: User with `email_verified: false` tries to write `/settings/company` -> `PERMISSION_DENIED`.
4. **Bank Details Tampering by Staff**: Sales rep attempts `update /settings/company` to change `bankAccountNumber` -> `PERMISSION_DENIED`.
5. **Developer Financial Snooping**: Active Developer attempts `get /projectFinancials/{projectId}` or `list /invoices` -> `PERMISSION_DENIED`.
6. **Developer Cross-Project Access**: Active Developer attempts `get /projects/{otherProjectId}` where `developerUid != request.auth.uid` -> `PERMISSION_DENIED`.
7. **Auto-Confirmed Payment Fraud**: Sales rep attempts `create /payments/{id}` with `verificationStatus: 'confirmed'` -> `PERMISSION_DENIED`.
8. **Financial Record Deletion**: Admin or Staff attempts `delete /payments/{id}` or `delete /invoices/{id}` -> `PERMISSION_DENIED`.
9. **Shadow Field Injection**: Authorised staff sends `update /customers/{id}` with extra ghost field `isVipBypass: true` -> `PERMISSION_DENIED`.
10. **ID Poisoning**: Attacker attempts `create /projects/bad..id$with$chars` or 1.5KB ID -> `PERMISSION_DENIED`.
11. **Customer Cross-Tenant Read**: Customer A attempts `get /onboardingForms/{formB}` belonging to Customer B -> `PERMISSION_DENIED`.
12. **Audit Log Tampering**: Staff attempts `update` or `delete` on `/activityLogs/{logId}` -> `PERMISSION_DENIED`.
