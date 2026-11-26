import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const AutomaticInstallPrompt: React.FC = () => {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isAndroid = /android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (!isAndroid || isStandalone) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!installEvent || busy) return;
    setBusy(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'accepted') setInstallEvent(null);
      else setInstallEvent(null);
    } finally {
      setBusy(false);
    }
  };

  if (!installEvent) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/pwa-192x192.png" alt="VISIBYL" className="h-12 w-12 rounded-xl" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Install VISIBYL Operations</h2>
              <p className="text-sm text-slate-500">Add the app to your phone</p>
            </div>
          </div>
          <button onClick={() => setInstallEvent(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close install prompt"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-4 text-sm text-slate-600">Install VISIBYL Operations for quick access from your phone.</p>
        <button onClick={install} disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0144D8] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
          <Download className="h-5 w-5" />
          {busy ? 'Opening installer…' : 'Install'}
        </button>
      </div>
    </div>
  );
};
