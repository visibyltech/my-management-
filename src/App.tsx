import React, { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BrandLogo } from './components/BrandLogo';
import { OfflineIndicator } from './components/PWAInstallButton';
import { AutomaticInstallPrompt } from './components/AutomaticInstallPrompt';
import { LoginScreen } from './components/LoginScreen';
import { PublicOnboardingForm } from './components/PublicOnboardingForm';
import { Layout } from './components/Layout';
import { DashboardView } from './components/DashboardView';
import { CustomersView } from './components/CustomersView';
import { StaffView } from './components/StaffView';
import { ProjectsView } from './components/ProjectsView';
import { OnboardingGeneratorView } from './components/OnboardingGeneratorView';
import { InvoicesView } from './components/InvoicesView';
import { PaymentsView } from './components/PaymentsView';
import { CommissionsView } from './components/CommissionsView';
import { ExpensesView } from './components/ExpensesView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { NavSection } from './types/visibyl';

function extractOnboardingIdFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const queryId = params.get('onboard');
  if (queryId && queryId.trim()) return queryId.trim();

  const match = window.location.pathname.match(/^\/onboard\/([^/]+)\/?$/);
  if (match && match[1]) return decodeURIComponent(match[1]);

  return null;
}

const AppContent: React.FC = () => {
  const {
    firebaseUser,
    authReady,
    isActiveStaff,
    isAdmin,
    isFinance,
    isSuperAdmin,
    isSales,
    isDeveloper,
    isSupport,
  } = useAuth();

  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [jumpVersion, setJumpVersion] = useState(0);
  const [onboardingFormId, setOnboardingFormId] = useState<string | null>(() =>
    extractOnboardingIdFromLocation()
  );

  useEffect(() => {
    const handlePopState = () => {
      setOnboardingFormId(extractOnboardingIdFromLocation());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openOnboardingForm = useCallback((formId: string) => {
    const url = new URL(window.location.href);
    url.pathname = '/';
    url.searchParams.set('onboard', formId);
    window.history.pushState({}, '', url.toString());
    setOnboardingFormId(formId);
  }, []);

  const exitOnboardingForm = useCallback(() => {
    const url = new URL(window.location.href);
    url.pathname = '/';
    url.searchParams.delete('onboard');
    window.history.pushState({}, '', url.toString());
    setOnboardingFormId(null);
  }, []);

  const canAccessSection = useCallback(
    (section: NavSection): boolean => {
      if (isDeveloper) {
        return ['dashboard', 'projects', 'onboarding', 'settings'].includes(section);
      }
      switch (section) {
        case 'dashboard':
        case 'customers':
        case 'projects':
        case 'onboarding':
        case 'settings':
          return true;
        case 'staff':
        case 'expenses':
        case 'invoices':
        case 'payments':
        case 'reports':
          return isSuperAdmin;
        case 'commissions':
          return isSuperAdmin || isActiveStaff;
        default:
          return false;
      }
    },
    [isActiveStaff, isAdmin, isDeveloper, isFinance, isSales, isSupport, isSuperAdmin]
  );

  const handleSelectSection = useCallback(
    (section: NavSection) => {
      setSelectedEntityId(null);
      setActiveSection(canAccessSection(section) ? section : 'dashboard');
    },
    [canAccessSection]
  );

  const handleQuickJump = useCallback(
    (section: NavSection, entityId?: string) => {
      const target = canAccessSection(section) ? section : 'dashboard';
      setActiveSection(target);
      setSelectedEntityId(entityId || null);
      setJumpVersion((v) => v + 1);
    },
    [canAccessSection]
  );

  useEffect(() => {
    if (!canAccessSection(activeSection)) {
      setActiveSection('dashboard');
    }
  }, [activeSection, canAccessSection]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#0144D8] flex flex-col items-center justify-center p-6 text-white">
        <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg bg-[#0144D8] border border-white/20 mb-4 animate-pulse">
          <BrandLogo variant="symbol" className="w-full h-full" />
        </div>
        <p className="text-lg font-bold tracking-tight">VISIBYL Technologies</p>
        <p className="text-xs text-blue-100 mt-1">Initializing operations workspace...</p>
      </div>
    );
  }

  if (onboardingFormId) {
    return (
      <>
        <PublicOnboardingForm formId={onboardingFormId} onExit={exitOnboardingForm} />
        <OfflineIndicator />
      </>
    );
  }

  if (!firebaseUser || !isActiveStaff) {
    return (
      <>
        <LoginScreen onOpenOnboardingForm={openOnboardingForm} />
        <OfflineIndicator />
      </>
    );
  }

  const effectiveSection = canAccessSection(activeSection) ? activeSection : 'dashboard';

  return (
    <>
      <Layout
        activeSection={effectiveSection}
        onSelectSection={handleSelectSection}
        onQuickJump={handleQuickJump}
      >
        {effectiveSection === 'dashboard' && (
          <DashboardView onNavigate={handleSelectSection} />
        )}
        {effectiveSection === 'customers' && (
          <CustomersView
            key={`customers-${jumpVersion}`}
            initialSelectedId={selectedEntityId}
            onNavigate={handleSelectSection}
            onOpenOnboarding={openOnboardingForm}
          />
        )}
        {effectiveSection === 'staff' && <StaffView />}
        {effectiveSection === 'projects' && (
          <ProjectsView
            key={`projects-${jumpVersion}`}
            initialSelectedId={selectedEntityId}
          />
        )}
        {effectiveSection === 'onboarding' && (
          <OnboardingGeneratorView onOpenForm={openOnboardingForm} />
        )}
        {effectiveSection === 'invoices' && (
          <InvoicesView
            key={`invoices-${jumpVersion}`}
            initialSelectedId={selectedEntityId}
          />
        )}
        {effectiveSection === 'payments' && <PaymentsView />}
        {effectiveSection === 'commissions' && <CommissionsView />}
        {effectiveSection === 'expenses' && <ExpensesView />}
        {effectiveSection === 'reports' && <ReportsView />}
        {effectiveSection === 'settings' && <SettingsView />}
      </Layout>
      <OfflineIndicator />
    </>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <DataProvider>
          <>
            <AppContent />
            <AutomaticInstallPrompt />
          </>
        </DataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
