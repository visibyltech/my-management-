import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  testConnection,
} from '../lib/firebase';
import { CompanySettings, StaffInvite, StaffMember, StaffPublic, StaffRole } from '../types/visibyl';
import {
  DEFAULT_DEPARTMENTS,
  DEFAULT_SERVICES,
  generateStaffCode,
} from '../utils/formatters';

const SUPER_ADMIN_EMAIL = 'visibyl.biz@gmail.com';

interface AuthContextValue {
  firebaseUser: User | null;
  staffProfile: StaffMember | null;
  authReady: boolean;
  authError: string | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isFinance: boolean;
  isSales: boolean;
  isDeveloper: boolean;
  isSupport: boolean;
  isActiveStaff: boolean;
  isCustomerOnly: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestStaffAccess: (payload: {
    fullName: string;
    phone: string;
    department: string;
    position: string;
    role: 'sales' | 'developer' | 'support';
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
  }) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [staffProfile, setStaffProfile] = useState<StaffMember | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadOrBootstrapStaff = async (user: User) => {
    const emailLower = (user.email || '').toLowerCase().trim();
    const now = new Date().toISOString();

    try {
      const staffRef = doc(db, 'staff', user.uid);
      const staffSnap = await getDoc(staffRef);

      if (staffSnap.exists()) {
        setStaffProfile(staffSnap.data() as StaffMember);
      } else if (emailLower === SUPER_ADMIN_EMAIL && user.emailVerified) {
        // Bootstrap Super Admin + Default Company Settings atomically
        const staffCode = generateStaffCode();
        const newStaff: StaffMember = {
          uid: user.uid,
          staffCode,
          fullName: user.displayName || 'Super Administrator',
          email: emailLower,
          phone: '',
          department: 'Administration',
          position: 'Super Administrator',
          role: 'super_admin',
          employmentStatus: 'active',
          createdAt: now,
          updatedAt: now,
        };
        const newPublic: StaffPublic = {
          uid: user.uid,
          staffCode,
          fullName: newStaff.fullName,
          department: newStaff.department,
          position: newStaff.position,
          role: 'super_admin',
          employmentStatus: 'active',
          updatedAt: now,
        };

        const batch = writeBatch(db);
        batch.set(staffRef, newStaff);
        batch.set(doc(db, 'staffPublic', user.uid), newPublic);

        const settingsRef = doc(db, 'settings', 'company');
        const settingsSnap = await getDoc(settingsRef);
        if (!settingsSnap.exists()) {
          const defaultSettings: CompanySettings = {
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
            updatedByUid: user.uid,
            updatedAt: now,
          };
          batch.set(settingsRef, defaultSettings);
        }

        await batch.commit();
        setStaffProfile(newStaff);
      } else if (user.emailVerified && emailLower) {
        // Check if this user has a pre-approved invite from Super Admin
        const inviteQ = query(
          collection(db, 'staffInvites'),
          where('email', '==', emailLower)
        );
        const inviteSnap = await getDocs(inviteQ);
        const validInviteDoc = inviteSnap.docs.find((d) => d.data().status === 'invited');

        if (validInviteDoc) {
          const invite = validInviteDoc.data() as StaffInvite;
          const newStaff: StaffMember = {
            uid: user.uid,
            staffCode: invite.staffCode,
            fullName: invite.fullName || user.displayName || emailLower,
            email: emailLower,
            phone: invite.phone || '',
            department: invite.department,
            position: invite.position,
            role: invite.role as StaffRole,
            employmentStatus: 'active',
            bankName: invite.bankName || '',
            bankAccountNumber: invite.bankAccountNumber || '',
            bankAccountName: invite.bankAccountName || '',
            inviteId: invite.id,
            createdAt: now,
            updatedAt: now,
          };
          const newPublic: StaffPublic = {
            uid: user.uid,
            staffCode: newStaff.staffCode,
            fullName: newStaff.fullName,
            department: newStaff.department,
            position: newStaff.position,
            role: newStaff.role,
            employmentStatus: 'active',
            updatedAt: now,
          };

          const batch = writeBatch(db);
          batch.set(staffRef, newStaff);
          batch.set(doc(db, 'staffPublic', user.uid), newPublic);
          batch.update(doc(db, 'staffInvites', invite.id), {
            status: 'claimed',
            updatedAt: now,
          });
          await batch.commit();
          setStaffProfile(newStaff);
        } else {
          setStaffProfile(null);
        }
      } else {
        setStaffProfile(null);
      }

      // Ensure Super Admin always ensures settings/company exists even if staff already existed
      if (emailLower === SUPER_ADMIN_EMAIL && user.emailVerified) {
        const settingsRef = doc(db, 'settings', 'company');
        const settingsSnap = await getDoc(settingsRef);
        if (!settingsSnap.exists()) {
          const defaultSettings: CompanySettings = {
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
            updatedByUid: user.uid,
            updatedAt: now,
          };
          const batch = writeBatch(db);
          batch.set(settingsRef, defaultSettings);
          await batch.commit();
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `staff/${user.uid}`);
    }
  };

  useEffect(() => {
    testConnection();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setAuthError(null);
      setFirebaseUser(user);
      if (user) {
        try {
          await loadOrBootstrapStaff(user);
        } catch (err) {
          setAuthError(err instanceof Error ? err.message : 'Unable to load user profile.');
        }
      } else {
        setStaffProfile(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await credential.user.reload();
      if (!credential.user.emailVerified) {
        await firebaseSignOut(auth);
        throw new Error('Please verify your email address before signing in. Check your inbox for the verification link.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Email sign-in failed.';
      setAuthError(msg);
      throw err;
    }
  };

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setAuthError(msg);
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(credential.user);
      await firebaseSignOut(auth);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Account creation failed.';
      setAuthError(msg);
      throw err;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setStaffProfile(null);
  };

  const requestStaffAccess = async (payload: {
    fullName: string;
    phone: string;
    department: string;
    position: string;
    role: 'sales' | 'developer' | 'support';
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
  }) => {
    if (!firebaseUser || !firebaseUser.email) {
      throw new Error('Please sign in first.');
    }
    const now = new Date().toISOString();
    const staffCode = generateStaffCode();
    const newStaff: StaffMember = {
      uid: firebaseUser.uid,
      staffCode,
      fullName: payload.fullName.trim(),
      email: firebaseUser.email.toLowerCase().trim(),
      phone: payload.phone.trim(),
      department: payload.department,
      position: payload.position.trim(),
      role: payload.role,
      employmentStatus: 'pending',
      bankName: payload.bankName?.trim() || '',
      bankAccountNumber: payload.bankAccountNumber?.trim() || '',
      bankAccountName: payload.bankAccountName?.trim() || '',
      createdAt: now,
      updatedAt: now,
    };
    const newPublic: StaffPublic = {
      uid: firebaseUser.uid,
      staffCode,
      fullName: newStaff.fullName,
      department: newStaff.department,
      position: newStaff.position,
      role: newStaff.role,
      employmentStatus: 'pending',
      updatedAt: now,
    };
    try {
      // Commit the pending staff request first. Admin notification is best-effort
      // so a notification write cannot roll back the staff application.
      const batch = writeBatch(db);
      batch.set(doc(db, 'staff', firebaseUser.uid), newStaff);
      batch.set(doc(db, 'staffPublic', firebaseUser.uid), newPublic);
      await batch.commit();

      const notifId = `NTF_${Date.now().toString(36).toUpperCase()}`;
      try {
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          targetRole: 'admins',
          type: 'staff_registered',
          title: 'New Staff Registration Request',
          message: `${newStaff.fullName} (${newStaff.department}) requested staff access.`,
          entityType: 'staff',
          entityId: firebaseUser.uid,
          isRead: false,
          createdByUid: firebaseUser.uid,
          createdAt: now,
        });
      } catch (notificationError) {
        console.warn('Staff request saved; admin notification could not be created:', notificationError);
      }
      setStaffProfile(newStaff);
      // Send the staff application alert to the fixed Super Admin inbox.
      try {
        const idToken = await firebaseUser.getIdToken();
        await fetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ event: 'staff_application', staffName: newStaff.fullName, staffEmail: newStaff.email, department: newStaff.department, requestedRole: newStaff.role }),
        });
      } catch (emailError) {
        console.warn('Staff application saved, but email notification could not be sent:', emailError);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `staff/${firebaseUser.uid}`);
    }
  };

  const refreshProfile = async () => {
    if (firebaseUser) {
      await loadOrBootstrapStaff(firebaseUser);
    }
  };

  const isBootstrappedEmail =
    (firebaseUser?.email || '').toLowerCase().trim() === SUPER_ADMIN_EMAIL &&
    Boolean(firebaseUser?.emailVerified);

  const isActive = isBootstrappedEmail || staffProfile?.employmentStatus === 'active';
  const role: StaffRole | null = isBootstrappedEmail
    ? 'super_admin'
    : isActive
      ? staffProfile?.role || null
      : null;

  const isSuperAdmin = role === 'super_admin';
  const isAdmin = isSuperAdmin || role === 'admin';
  const isFinance = isAdmin || role === 'finance';
  const isSales = role === 'sales';
  const isDeveloper = role === 'developer';
  const isSupport = role === 'support';
  const isActiveStaff = isActive && role !== null;
  const isCustomerOnly = Boolean(firebaseUser && !staffProfile && !isBootstrappedEmail);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        staffProfile,
        authReady,
        authError,
        isSuperAdmin,
        isAdmin,
        isFinance,
        isSales,
        isDeveloper,
        isSupport,
        isActiveStaff,
        isCustomerOnly,
        signInWithEmail,
        signInWithGoogle,
        signUpWithEmail,
        signOut,
        requestStaffAccess,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
