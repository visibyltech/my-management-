export function formatNaira(amount: number | undefined | null, showDecimals = false): string {
  const num = Number(amount || 0);
  const formatted = new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(num);
  return `₦${formatted}`;
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function makeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function randomDigits(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

export function generateCustomerCode(): string {
  return `VSB-CUS-${randomDigits(5)}`;
}

export function generateCustomerAccountNumber(): string {
  // Unique 10-digit VISIBYL virtual customer account number starting with 308
  return `308${randomDigits(7)}`;
}

export function generateStaffCode(): string {
  return `VSB-STF-${randomDigits(4)}`;
}

export function generateProjectCode(): string {
  return `VSB-PRJ-${randomDigits(5)}`;
}

export function generateInvoiceNumber(): string {
  const yr = new Date().getFullYear();
  return `VSB-INV-${yr}-${randomDigits(4)}`;
}

export function generateReceiptNumber(): string {
  return `VSB-PAY-${randomDigits(6)}`;
}

export function generateExpenseCode(): string {
  return `VSB-EXP-${randomDigits(5)}`;
}

export function generateOnboardingCode(): string {
  return `VSB-ONB-${randomDigits(5)}`;
}

export type TimeframeFilter = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all';

export function isWithinTimeframe(dateStr: string | undefined, timeframe: TimeframeFilter): boolean {
  if (timeframe === 'all') return true;
  if (!dateStr) return false;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return false;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (timeframe === 'daily') {
    return target >= startOfToday;
  }
  if (timeframe === 'weekly') {
    const weekAgo = new Date(startOfToday);
    weekAgo.setDate(weekAgo.getDate() - 6);
    return target >= weekAgo;
  }
  if (timeframe === 'monthly') {
    return target.getFullYear() === now.getFullYear() && target.getMonth() === now.getMonth();
  }
  if (timeframe === 'yearly') {
    return target.getFullYear() === now.getFullYear();
  }
  return true;
}

export function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export const DEFAULT_DEPARTMENTS = [
  'Sales and Marketing',
  'Administration',
  'Development',
  'Customer Support',
  'Finance',
];

export const DEFAULT_SERVICES = [
  'Website development',
  'E-commerce and sales automation systems',
  'Social media management',
  'Social media campaigns and advertising',
  'CAC business registration',
  'Branding and graphic design',
  'Digital marketing',
];

export const EXPENSE_CATEGORIES = [
  'Hosting',
  'Domains',
  'Advertising',
  'Staff Payments',
  'Commissions',
  'Subscriptions',
  'Transport',
  'Office & Operations',
  'Other',
];

export const SERVICE_QUESTIONS: Record<string, { key: string; label: string; placeholder: string }[]> = {
  'Website development': [
    { key: 'domainPreference', label: 'Preferred Domain Name & Hosting Status', placeholder: 'e.g. mycompany.com.ng (already registered or new)' },
    { key: 'targetPages', label: 'Required Pages & Key Features', placeholder: 'e.g. Home, About, Services, Blog, Booking Form, WhatsApp Chat' },
    { key: 'referenceSites', label: 'Reference Websites or Inspiration Links', placeholder: 'Share 1-3 URLs whose layout or tone you admire' },
  ],
  'E-commerce and sales automation systems': [
    { key: 'productCatalogSize', label: 'Estimated Number of Products / SKUs', placeholder: 'e.g. 40 fashion items across 4 categories' },
    { key: 'paymentGateways', label: 'Preferred Payment & Delivery Setup', placeholder: 'e.g. Paystack, Kuda transfer, Lagos same-day dispatch' },
    { key: 'automationWorkflows', label: 'Sales Automation Needs', placeholder: 'e.g. Automated WhatsApp order receipts, abandoned cart follow-up' },
  ],
  'Social media management': [
    { key: 'platforms', label: 'Active Social Media Platforms & Handles', placeholder: 'e.g. Instagram @brand, TikTok @brand, LinkedIn' },
    { key: 'postingFrequency', label: 'Target Monthly Content Volume', placeholder: 'e.g. 16 posts/month + 8 reels' },
    { key: 'brandTone', label: 'Brand Voice & Content Pillars', placeholder: 'e.g. Educational, luxury corporate, behind-the-scenes' },
  ],
  'Social media campaigns and advertising': [
    { key: 'campaignObjective', label: 'Primary Campaign Objective', placeholder: 'e.g. WhatsApp leads, website purchases, brand awareness' },
    { key: 'targetLocations', label: 'Target Geographic Locations & Demographics', placeholder: 'e.g. Lagos, Abuja, Port Harcourt · Business owners 25-45' },
    { key: 'adBudget', label: 'Estimated Monthly Ad Spend Budget (₦)', placeholder: 'e.g. ₦150,000/month' },
  ],
  'CAC business registration': [
    { key: 'registrationType', label: 'Registration Entity Type', placeholder: 'Business Name (Enterprise) or Limited Liability Company (LTD)' },
    { key: 'proposedNames', label: 'Two Proposed Business Names (in order of preference)', placeholder: '1. ...  2. ...' },
    { key: 'directorsInfo', label: 'Proprietor / Directors Full Names & Ownership Split', placeholder: 'List full legal names, NIN availability, and shareholding %' },
  ],
  'Branding and graphic design': [
    { key: 'deliverablesNeeded', label: 'Brand Assets Needed', placeholder: 'e.g. Logo suite, letterhead, flyer templates, packaging' },
    { key: 'colorPreferences', label: 'Preferred Colours & Visual Mood', placeholder: 'e.g. Royal blue & white, minimalist luxury, bold modern' },
    { key: 'brandValues', label: '3 Words Describing Your Brand Personality', placeholder: 'e.g. Trustworthy, innovative, unforgettable' },
  ],
  'Digital marketing': [
    { key: 'marketingChannels', label: 'Priority Digital Channels', placeholder: 'e.g. Google Search Ads, Email Marketing, SEO, Meta Ads' },
    { key: 'monthlyGoals', label: '90-Day Growth Target', placeholder: 'e.g. 50 qualified inbound leads per month' },
    { key: 'existingAssets', label: 'Existing Website, Pixel, or Analytics Access', placeholder: 'Share current website URL or Google Analytics availability' },
  ],
};
