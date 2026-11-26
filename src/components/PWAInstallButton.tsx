import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        type="button"
        className={`inline-flex items-center justify-center gap-2 rounded-lg bg-[#0144D8] text-white font-semibold hover:bg-[#0133A6] transition-colors whitespace-nowrap shrink-0 ${
          compact ? 'px-3 py-2 text-xs' : 'px-4 py-2 text-xs'
        }`}
      >
        <Download className="w-4 h-4" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Smartphone className="w-4 h-4 text-[#0144D8]" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Install Visibyl Ops on iOS</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-2.5 text-sm text-slate-600 list-decimal list-inside">
                <li>
                  Tap the <strong>Share</strong> icon in the Safari toolbar.
                </li>
                <li>
                  Scroll down and tap <strong>Add to Home Screen</strong>.
                </li>
                <li>
                  Tap <strong>Add</strong> to install Visibyl Ops with the official VISIBYL icon.
                </li>
              </ol>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-[#0144D8] py-2.5 text-sm font-semibold text-white hover:bg-[#0133A6] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (isAndroid) {
    return (
      <>
        <button
          onClick={() => setShowAndroidGuide(true)}
          type="button"
          className={`inline-flex items-center justify-center gap-2 rounded-lg bg-[#0144D8] text-white font-semibold hover:bg-[#0133A6] transition-colors whitespace-nowrap shrink-0 ${compact ? 'px-3 py-2 text-xs' : 'px-4 py-2 text-xs'}`}
        >
          <Download className="w-4 h-4" />
          <span>Install App</span>
        </button>
        {showAndroidGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-slate-900">Install Visibyl Ops</h3>
                <button onClick={() => setShowAndroidGuide(false)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-3 text-sm text-slate-600">Chrome has not provided its one-tap install prompt on this visit. You can still check its install option:</p>
              <ol className="mt-3 space-y-2 text-sm text-slate-700 list-decimal list-inside">
                <li>Tap Chrome's three-dot menu in the top-right corner.</li>
                <li>Look for <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                <li>Tap it and follow the confirmation shown by Chrome.</li>
              </ol>
              <p className="mt-3 text-xs text-slate-500">If neither option appears, Chrome currently considers the site not installable. This button cannot override that browser restriction.</p>
              <button onClick={() => setShowAndroidGuide(false)} className="mt-5 w-full rounded-lg bg-[#0144D8] py-2.5 text-sm font-semibold text-white">Close</button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white">
      <WifiOff className="w-4 h-4" />
      <span>Offline Mode — Changes will sync when connection returns</span>
    </div>
  );
};
