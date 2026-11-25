import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

interface FirebaseConfigFile {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId: string;
}

function loadFirebaseConfig(): FirebaseConfigFile {
  const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
  const raw = fs.readFileSync(cfgPath, 'utf-8');
  return JSON.parse(raw) as FirebaseConfigFile;
}

interface VerifiedCaller {
  uid: string;
  email: string;
  emailVerified: boolean;
  idToken: string;
  role: string;
  employmentStatus: string;
}

function decodeFirestoreValue(val: Record<string, unknown>): unknown {
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    const arr = (val.arrayValue as { values?: Record<string, unknown>[] }).values || [];
    return arr.map(decodeFirestoreValue);
  }
  if ('mapValue' in val) {
    const fields = (val.mapValue as { fields?: Record<string, Record<string, unknown>> }).fields || {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeFirestoreValue(v);
    }
    return out;
  }
  return null;
}

function decodeDocument(doc: { name: string; fields?: Record<string, Record<string, unknown>> }): Record<string, unknown> {
  const id = doc.name.split('/').pop() || '';
  const out: Record<string, unknown> = { id };
  if (doc.fields) {
    for (const [k, v] of Object.entries(doc.fields)) {
      out[k] = decodeFirestoreValue(v);
    }
  }
  return out;
}

async function fetchFirestoreCollection(
  cfg: FirebaseConfigFile,
  collectionName: string,
  idToken: string
): Promise<Record<string, unknown>[]> {
  const dbId = cfg.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${dbId}/documents/${collectionName}?pageSize=500`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!resp.ok) {
    if (resp.status === 403 || resp.status === 404) {
      return [];
    }
    throw new Error(`Firestore read failed for ${collectionName}: ${resp.status}`);
  }
  const data = (await resp.json()) as {
    documents?: { name: string; fields?: Record<string, Record<string, unknown>> }[];
  };
  return (data.documents || []).map(decodeDocument);
}

async function fetchFirestoreDoc(
  cfg: FirebaseConfigFile,
  docPath: string,
  idToken: string
): Promise<Record<string, unknown> | null> {
  const dbId = cfg.firestoreDatabaseId || '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${dbId}/documents/${docPath}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!resp.ok) return null;
  const doc = (await resp.json()) as { name: string; fields?: Record<string, Record<string, unknown>> };
  return decodeDocument(doc);
}

async function verifyVisaraCaller(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const visaraKeyHeader = req.headers['x-visara-api-key'];
    const configuredKey = process.env.VISARA_API_KEY;

    if (configuredKey && visaraKeyHeader && visaraKeyHeader !== configuredKey) {
      res.status(403).json({ error: 'Invalid VISARA API key.' });
      return;
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization Bearer Firebase ID token is required.' });
      return;
    }

    const idToken = authHeader.slice(7).trim();
    if (!idToken) {
      res.status(401).json({ error: 'Empty Bearer token.' });
      return;
    }

    const cfg = loadFirebaseConfig();
    const lookupResp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${cfg.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );

    if (!lookupResp.ok) {
      res.status(401).json({ error: 'Invalid or expired Firebase ID token.' });
      return;
    }

    const lookupData = (await lookupResp.json()) as {
      users?: { localId: string; email?: string; emailVerified?: boolean }[];
    };
    const user = lookupData.users?.[0];
    if (!user || !user.email || !user.emailVerified) {
      res.status(403).json({ error: 'Verified account email is required.' });
      return;
    }

    const isBootstrappedSuperAdmin = user.email.toLowerCase() === 'visibyl.biz@gmail.com';
    const staffDoc = await fetchFirestoreDoc(cfg, `staff/${user.localId}`, idToken);

    const role = isBootstrappedSuperAdmin
      ? 'super_admin'
      : typeof staffDoc?.role === 'string'
        ? staffDoc.role
        : 'guest';
    const employmentStatus = isBootstrappedSuperAdmin
      ? 'active'
      : typeof staffDoc?.employmentStatus === 'string'
        ? staffDoc.employmentStatus
        : 'none';

    if (employmentStatus !== 'active') {
      res.status(403).json({ error: 'Active VISIBYL staff clearance required for VISARA API.' });
      return;
    }

    (req as Request & { visaraCaller?: VerifiedCaller }).visaraCaller = {
      uid: user.localId,
      email: user.email.toLowerCase(),
      emailVerified: Boolean(user.emailVerified),
      idToken,
      role,
      employmentStatus,
    };
    next();
  } catch (err) {
    console.error('VISARA auth error:', err);
    res.status(500).json({ error: 'Failed to authenticate VISARA request.' });
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'visibyl-operations', timestamp: new Date().toISOString() });
  });

  // VISARA AI Assistant Integration Endpoints
  app.get('/api/visara/capabilities', verifyVisaraCaller, (req, res) => {
    const caller = (req as Request & { visaraCaller: VerifiedCaller }).visaraCaller;
    const isFinancialAuthorized = ['super_admin', 'admin', 'finance'].includes(caller.role);
    res.json({
      assistant: 'VISARA',
      organization: 'VISIBYL Technologies',
      callerRole: caller.role,
      permissions: {
        searchRecords: true,
        retrieveProjects: true,
        financialReports: isFinancialAuthorized,
        outstandingPayments: isFinancialAuthorized || caller.role === 'sales',
        staffPerformance: ['super_admin', 'admin', 'finance', 'sales'].includes(caller.role),
      },
      endpoints: [
        '/api/visara/capabilities',
        '/api/visara/search?q=',
        '/api/visara/projects/:id',
        '/api/visara/financial-summary',
        '/api/visara/outstanding-payments',
        '/api/visara/staff-performance',
      ],
    });
  });

  app.get('/api/visara/search', verifyVisaraCaller, async (req, res) => {
    try {
      const caller = (req as Request & { visaraCaller: VerifiedCaller }).visaraCaller;
      const q = String(req.query.q || '').trim().toLowerCase();
      if (!q || q.length > 100) {
        res.status(400).json({ error: 'Query parameter q (1-100 chars) is required.' });
        return;
      }

      const cfg = loadFirebaseConfig();
      const [customers, projects, invoices] = await Promise.all([
        caller.role === 'developer' ? Promise.resolve([]) : fetchFirestoreCollection(cfg, 'customers', caller.idToken),
        fetchFirestoreCollection(cfg, 'projects', caller.idToken),
        caller.role === 'developer' ? Promise.resolve([]) : fetchFirestoreCollection(cfg, 'invoices', caller.idToken),
      ]);

      const matchStr = (v: unknown) => typeof v === 'string' && v.toLowerCase().includes(q);

      res.json({
        query: q,
        results: {
          customers: customers.filter(
            (c) => matchStr(c.fullName) || matchStr(c.businessName) || matchStr(c.customerCode) || matchStr(c.accountNumber) || matchStr(c.email) || matchStr(c.phone)
          ),
          projects: projects.filter(
            (p) => matchStr(p.title) || matchStr(p.projectCode) || matchStr(p.customerName) || matchStr(p.serviceType)
          ),
          invoices: invoices.filter(
            (inv) => matchStr(inv.invoiceNumber) || matchStr(inv.customerName) || matchStr(inv.projectCode)
          ),
        },
      });
    } catch (err) {
      console.error('VISARA search error:', err);
      res.status(500).json({ error: 'VISARA search query failed.' });
    }
  });

  app.get('/api/visara/projects/:id', verifyVisaraCaller, async (req, res) => {
    try {
      const caller = (req as Request & { visaraCaller: VerifiedCaller }).visaraCaller;
      const projectId = String(req.params.id || '').trim();
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(projectId)) {
        res.status(400).json({ error: 'Invalid project ID format.' });
        return;
      }
      const cfg = loadFirebaseConfig();
      const project = await fetchFirestoreDoc(cfg, `projects/${projectId}`, caller.idToken);
      if (!project) {
        res.status(404).json({ error: 'Project not found or access denied.' });
        return;
      }
      const financials =
        caller.role === 'developer'
          ? null
          : await fetchFirestoreDoc(cfg, `projectFinancials/${projectId}`, caller.idToken);
      res.json({ project, financials });
    } catch (err) {
      console.error('VISARA project error:', err);
      res.status(500).json({ error: 'Failed to fetch project details.' });
    }
  });

  app.get('/api/visara/financial-summary', verifyVisaraCaller, async (req, res) => {
    try {
      const caller = (req as Request & { visaraCaller: VerifiedCaller }).visaraCaller;
      if (!['super_admin', 'admin', 'finance'].includes(caller.role)) {
        res.status(403).json({ error: 'Financial summary restricted to Admin and Finance.' });
        return;
      }
      const cfg = loadFirebaseConfig();
      const [payments, expenses, financials] = await Promise.all([
        fetchFirestoreCollection(cfg, 'payments', caller.idToken),
        fetchFirestoreCollection(cfg, 'expenses', caller.idToken),
        fetchFirestoreCollection(cfg, 'projectFinancials', caller.idToken),
      ]);

      const confirmedRevenue = payments
        .filter((p) => p.verificationStatus === 'confirmed')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const pendingVerification = payments
        .filter((p) => p.verificationStatus === 'pending')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const outstandingBalances = financials.reduce((sum, f) => sum + Number(f.outstandingBalance || 0), 0);

      res.json({
        currency: 'NGN',
        confirmedRevenue,
        pendingVerification,
        outstandingBalances,
        totalExpenses,
        netIncome: confirmedRevenue - totalExpenses,
      });
    } catch (err) {
      console.error('VISARA financial summary error:', err);
      res.status(500).json({ error: 'Failed to generate financial summary.' });
    }
  });

  app.get('/api/visara/outstanding-payments', verifyVisaraCaller, async (req, res) => {
    try {
      const caller = (req as Request & { visaraCaller: VerifiedCaller }).visaraCaller;
      if (caller.role === 'developer') {
        res.status(403).json({ error: 'Developers cannot access confidential financial data.' });
        return;
      }
      const cfg = loadFirebaseConfig();
      const [financials, payments] = await Promise.all([
        fetchFirestoreCollection(cfg, 'projectFinancials', caller.idToken),
        fetchFirestoreCollection(cfg, 'payments', caller.idToken),
      ]);
      res.json({
        outstandingProjects: financials.filter((f) => Number(f.outstandingBalance || 0) > 0),
        pendingVerificationPayments: payments.filter((p) => p.verificationStatus === 'pending'),
      });
    } catch (err) {
      console.error('VISARA outstanding error:', err);
      res.status(500).json({ error: 'Failed to fetch outstanding payments.' });
    }
  });

  app.get('/api/visara/staff-performance', verifyVisaraCaller, async (req, res) => {
    try {
      const caller = (req as Request & { visaraCaller: VerifiedCaller }).visaraCaller;
      if (!['super_admin', 'admin', 'finance', 'sales'].includes(caller.role)) {
        res.status(403).json({ error: 'Insufficient clearance for staff performance reports.' });
        return;
      }
      const cfg = loadFirebaseConfig();
      const [customers, payments, commissions] = await Promise.all([
        fetchFirestoreCollection(cfg, 'customers', caller.idToken),
        fetchFirestoreCollection(cfg, 'payments', caller.idToken),
        fetchFirestoreCollection(cfg, 'commissions', caller.idToken),
      ]);

      const repStats: Record<
        string,
        { salesRepUid: string; salesRepName: string; customersRegistered: number; confirmedPayments: number; commissionEarned: number }
      > = {};

      for (const c of customers) {
        const uid = String(c.salesRepUid || '');
        if (!uid) continue;
        if (!repStats[uid]) {
          repStats[uid] = {
            salesRepUid: uid,
            salesRepName: String(c.salesRepName || 'Staff'),
            customersRegistered: 0,
            confirmedPayments: 0,
            commissionEarned: 0,
          };
        }
        repStats[uid].customersRegistered += 1;
      }

      for (const p of payments) {
        if (p.verificationStatus !== 'confirmed') continue;
        const uid = String(p.salesRepUid || '');
        if (repStats[uid]) {
          repStats[uid].confirmedPayments += Number(p.amount || 0);
        }
      }

      for (const cm of commissions) {
        const uid = String(cm.salesRepUid || '');
        if (repStats[uid]) {
          repStats[uid].commissionEarned += Number(cm.commissionAmount || 0);
        }
      }

      res.json({ staffPerformance: Object.values(repStats) });
    } catch (err) {
      console.error('VISARA staff performance error:', err);
      res.status(500).json({ error: 'Failed to compute staff performance.' });
    }
  });

  // Mobile Android/iOS Capacitor Packaging Manifest Download
  app.get('/api/mobile/build-kit', (_req, res) => {
    const kit = {
      appName: 'Visibyl Ops',
      bundleId: 'com.visibyltechnologies.operations',
      platformTargets: {
        android: {
          format: 'APK / AAB',
          requirements: ['Node.js 20+', 'Android Studio / JDK 17', 'Android SDK'],
          commands: [
            'npm run build',
            'npm install @capacitor/core @capacitor/cli @capacitor/android',
            'npx cap add android',
            'npx cap sync android',
            'cd android && ./gradlew assembleRelease',
          ],
          outputApkPath: 'android/app/build/outputs/apk/release/app-release.apk',
        },
        ios: {
          format: 'IPA (TestFlight / App Store / Ad-Hoc)',
          requirements: ['macOS with Xcode 15+', 'Apple Developer Account', 'CocoaPods'],
          commands: [
            'npm run build',
            'npm install @capacitor/core @capacitor/cli @capacitor/ios',
            'npx cap add ios',
            'npx cap sync ios',
            'npx cap open ios',
          ],
          distribution: 'Archive in Xcode -> Distribute App -> TestFlight / App Store Connect',
        },
      },
      capacitorConfig: {
        appId: 'com.visibyltechnologies.operations',
        appName: 'Visibyl Ops',
        webDir: 'dist',
      },
    };
    res.setHeader('Content-Disposition', 'attachment; filename="visibyl-mobile-build-kit.json"');
    res.json(kit);
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'VISIBYL API endpoint not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Visibyl Operations server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
