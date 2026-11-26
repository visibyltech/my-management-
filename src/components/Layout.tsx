import React, { useMemo, useState } from 'react';
import {
  BadgePercent,
  BarChart3,
  Bell,
  Briefcase,
  CheckCheck,
  CreditCard,
  FileCheck2,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Search,
  Settings,
  Users,
  UserSquare2,
  X,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { NavSection } from '../types/visibyl';
import { formatDateTime, formatNaira } from '../utils/formatters';

interface LayoutProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  onQuickJump?: (section: NavSection, entityId?: string) => void;
  children: React.ReactNode;
}

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.FC<{ className?: string }>;
}

export const Layout: React.FC<LayoutProps> = ({
  activeSection,
  onSelectSection,
  onQuickJump,
  children,
}) => {
  const { staffProfile, firebaseUser, signOut, isSuperAdmin, isAdmin, isFinance, isSales, isDeveloper, isSupport } = useAuth();
  const { customers, projects, invoices, payments, staffPublic, notifications, markNotificationRead, markAllNotificationsRead } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: NavItem[] = useMemo(() => {
    if (isDeveloper) {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'projects', label: 'Projects', icon: Briefcase },
        { id: 'onboarding', label: 'Onboarding', icon: FileCheck2 },
        { id: 'settings', label: 'Settings', icon: Settings },
      ];
    }

    const items: NavItem[] = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'customers', label: 'Customers', icon: Users },
    ];

    if (isSuperAdmin) {
      items.push({ id: 'staff', label: 'Staff', icon: UserSquare2 });
    }

    items.push({ id: 'projects', label: 'Projects', icon: Briefcase });
    items.push({ id: 'onboarding', label: 'Onboarding', icon: FileCheck2 });

    if (isSuperAdmin) {
      items.push({ id: 'invoices', label: 'Invoices', icon: FileSpreadsheet });
      items.push({ id: 'payments', label: 'Payments', icon: CreditCard });
      items.push({ id: 'expenses', label: 'Expenses', icon: Receipt });
      items.push({ id: 'reports', label: 'Reports', icon: BarChart3 });
    }

    if (isSuperAdmin || isSales || isDeveloper || isSupport) {
      items.push({ id: 'commissions', label: 'My Commission', icon: BadgePercent });
    }

    items.push({ id: 'settings', label: 'Settings', icon: Settings });
    return items;
  }, [isAdmin, isFinance, isSales, isDeveloper, isSupport, isSuperAdmin]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Universal Search across Customers, Employees, Projects, Invoices, Payments
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return null;

    const matchedCustomers = isDeveloper
      ? []
      : customers
          .filter(
            (c) =>
              c.fullName.toLowerCase().includes(q) ||
              c.businessName.toLowerCase().includes(q) ||
              c.customerCode.toLowerCase().includes(q) ||
              c.accountNumber.toLowerCase().includes(q) ||
              c.email.toLowerCase().includes(q) ||
              c.phone.toLowerCase().includes(q)
          )
          .slice(0, 5);

    const matchedProjects = projects
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.projectCode.toLowerCase().includes(q) ||
          p.customerName.toLowerCase().includes(q) ||
          p.customerBusinessName.toLowerCase().includes(q)
      )
      .slice(0, 5);

    const matchedInvoices = isDeveloper
      ? []
      : invoices
          .filter(
            (i) =>
              i.invoiceNumber.toLowerCase().includes(q) ||
              i.customerName.toLowerCase().includes(q) ||
              (i.customerBusinessName || '').toLowerCase().includes(q)
          )
          .slice(0, 4);

    const matchedPayments = isDeveloper
      ? []
      : payments
          .filter(
            (p) =>
              p.receiptNumber.toLowerCase().includes(q) ||
              p.transactionReference.toLowerCase().includes(q) ||
              p.customerName.toLowerCase().includes(q)
          )
          .slice(0, 4);

    const matchedStaff = staffPublic
      .filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          s.staffCode.toLowerCase().includes(q) ||
          s.department.toLowerCase().includes(q)
      )
      .slice(0, 4);

    return {
      customers: matchedCustomers,
      projects: matchedProjects,
      invoices: matchedInvoices,
      payments: matchedPayments,
      staff: matchedStaff,
    };
  }, [searchQuery, customers, projects, invoices, payments, staffPublic, isDeveloper]);

  const mobilePrimaryTabs = navItems.slice(0, 4);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#0B1B3D] text-white border-r border-slate-800 no-print">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-[#0144D8] shrink-0">
            <BrandLogo variant="symbol" className="w-full h-full" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight text-white truncate">VISIBYL Ops</p>
            <p className="text-[11px] text-blue-200 truncate">
              {isSuperAdmin ? 'Super Admin' : staffProfile?.department || 'Operations'}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectSection(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#0144D8] text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {staffProfile?.fullName || firebaseUser?.displayName}
              </p>
              <p className="text-[11px] text-slate-400 font-mono-tabular truncate">
                {staffProfile?.staffCode || 'VSB-ADMIN'}
              </p>
            </div>
            <button
              onClick={signOut}
              title="Sign Out"
              className="p-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar (Strictly 1 row, crisp, compact on mobile <= 56px) */}
        <header className="sticky top-0 z-30 h-14 lg:h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <div className="lg:hidden w-8 h-8 rounded-lg overflow-hidden bg-[#0144D8] shrink-0">
              <BrandLogo variant="symbol" className="w-full h-full" />
            </div>
            <h1 className="text-base lg:text-lg font-bold text-slate-900 capitalize truncate">
              {activeSection === 'dashboard' && isDeveloper
                ? 'Developer Workspace'
                : activeSection === 'onboarding'
                  ? 'Onboarding Forms'
                  : activeSection}
            </h1>
          </div>

          {/* Universal Search Bar */}
          <div className="relative flex-1 max-w-md hidden sm:block">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Search customer, ID, account no, project, invoice..."
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0144D8]"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchOpen(false);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {searchOpen && searchResults && (
              <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-96 overflow-y-auto z-50 p-2 space-y-2">
                {searchResults.customers.length === 0 &&
                searchResults.projects.length === 0 &&
                searchResults.invoices.length === 0 &&
                searchResults.payments.length === 0 &&
                searchResults.staff.length === 0 ? (
                  <p className="p-3 text-xs text-slate-500 text-center">No matching records found.</p>
                ) : (
                  <>
                    {searchResults.customers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSearchOpen(false);
                          onQuickJump ? onQuickJump('customers', c.id) : onSelectSection('customers');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">{c.businessName} · {c.fullName}</p>
                          <p className="text-[11px] font-mono-tabular text-slate-500">{c.customerCode} · Acct {c.accountNumber}</p>
                        </div>
                        <span className="text-[11px] font-semibold text-[#0144D8]">Customer</span>
                      </button>
                    ))}
                    {searchResults.projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSearchOpen(false);
                          onQuickJump ? onQuickJump('projects', p.id) : onSelectSection('projects');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">{p.title}</p>
                          <p className="text-[11px] font-mono-tabular text-slate-500">{p.projectCode} · {p.status}</p>
                        </div>
                        <span className="text-[11px] font-semibold text-[#0144D8]">Project</span>
                      </button>
                    ))}
                    {searchResults.invoices.map((inv) => (
                      <button
                        key={inv.id}
                        onClick={() => {
                          setSearchOpen(false);
                          onQuickJump ? onQuickJump('invoices', inv.id) : onSelectSection('invoices');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 font-mono-tabular">{inv.invoiceNumber}</p>
                          <p className="text-[11px] text-slate-500 truncate">{inv.customerBusinessName || inv.customerName}</p>
                        </div>
                        <span className="text-[11px] font-mono-tabular font-semibold text-slate-800">{formatNaira(inv.totalAmount)}</span>
                      </button>
                    ))}
                    {searchResults.payments.map((pay) => (
                      <button
                        key={pay.id}
                        onClick={() => {
                          setSearchOpen(false);
                          onSelectSection('payments');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 font-mono-tabular">{pay.receiptNumber} · {pay.transactionReference}</p>
                          <p className="text-[11px] text-slate-500 truncate">{pay.customerName}</p>
                        </div>
                        <span className="text-[11px] font-mono-tabular font-semibold text-emerald-700">{formatNaira(pay.amount)}</span>
                      </button>
                    ))}
                    {searchResults.staff.map((st) => (
                      <button
                        key={st.uid}
                        onClick={() => {
                          setSearchOpen(false);
                          onSelectSection(isAdmin || isFinance ? 'staff' : 'projects');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">{st.fullName}</p>
                          <p className="text-[11px] font-mono-tabular text-slate-500">{st.staffCode} · {st.department}</p>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-600">Staff</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:block">
              <PWAInstallButton compact />
            </div>

            {/* Notification Drawer Trigger */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#0144D8] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Notifications ({unreadCount} unread)</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllNotificationsRead()}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0144D8] hover:underline"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <p className="p-6 text-xs text-slate-500 text-center">No notifications yet.</p>
                    ) : (
                      notifications.slice(0, 20).map((n) => (
                        <button
                          key={n.id}
                          onClick={() => markNotificationRead(n.id)}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                            n.isRead ? 'bg-white' : 'bg-[#F0F5FF]'
                          }`}
                        >
                          <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                          <p className="text-xs text-slate-600 mt-0.5 leading-snug">{n.message}</p>
                          <p className="text-[11px] text-slate-400 mt-1">{formatDateTime(n.createdAt)}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <PWAInstallButton compact />
          </div>
        </header>

        {/* Mobile Search Bar below header on xs */}
        <div className="sm:hidden px-4 pt-3 no-print">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Search customer, ID, account no, project..."
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0144D8]"
            />
          </div>
        </div>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-10 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (Thumb Zone) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe no-print">
        <div className="grid grid-cols-5 h-16 items-center">
          {mobilePrimaryTabs.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectSection(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-1 ${
                  active ? 'text-[#0144D8]' : 'text-slate-500'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold truncate max-w-[64px]">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="min-h-[44px] flex flex-col items-center justify-center gap-1 text-slate-600"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-semibold">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile More Sheet */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end no-print">
          <div className="w-full bg-white rounded-t-3xl p-5 pb-8 max-h-[80vh] overflow-y-auto">
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-slate-900">VISIBYL Operations Menu</p>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectSection(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`min-h-[48px] flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-semibold ${
                      active
                        ? 'bg-[#0144D8] border-[#0144D8] text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <PWAInstallButton compact />
              <button
                onClick={signOut}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
