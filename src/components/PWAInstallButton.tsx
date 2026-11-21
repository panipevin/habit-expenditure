import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] dark:bg-[#3B82F6] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#1E40AF] dark:hover:bg-[#2563EB] transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        {compact ? 'Install' : 'Install App'}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-white dark:bg-[#121722] px-3.5 py-2 text-xs font-medium text-[#0E1525] dark:text-[#F1F5F9] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130] transition-colors whitespace-nowrap shrink-0"
      >
        <Smartphone className="w-3.5 h-3.5 text-[#1D4ED8] dark:text-[#60A5FA]" />
        {isIOS ? 'Install on iOS' : compact ? 'Install PWA' : 'Install on Mobile & Desktop'}
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6">
            <div className="flex items-center justify-between gap-4">
              <h3 id="pwa-install-title" className="font-display text-lg font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                Install Cadence App
              </h3>
              <button
                type="button"
                aria-label="Close install instructions"
                onClick={() => setShowGuide(false)}
                className="p-2 rounded-lg text-[#556075] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-[#556075] dark:text-[#94A3B8]">
              Cadence runs offline as a standalone app across iOS, Android, and desktop browsers.
            </p>
            <div className="mt-4 space-y-3 text-sm text-[#0E1525] dark:text-[#E2E8F0]">
              <div className="pt-3 border-t border-[#E2E6ED] dark:border-[#1F2737]">
                <p className="font-semibold">iPhone &amp; iPad (Safari)</p>
                <p className="mt-1 text-xs text-[#556075] dark:text-[#94A3B8]">
                  Tap the Share icon in Safari, then choose &ldquo;Add to Home Screen&rdquo;.
                </p>
              </div>
              <div className="pt-3 border-t border-[#E2E6ED] dark:border-[#1F2737]">
                <p className="font-semibold">Android &amp; Desktop (Chrome / Edge)</p>
                <p className="mt-1 text-xs text-[#556075] dark:text-[#94A3B8]">
                  Open the browser menu and select &ldquo;Install Cadence&rdquo; for offline service-worker access.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-lg bg-[#0E1525] dark:bg-[#F1F5F9] py-2.5 text-sm font-medium text-white dark:text-[#0E1525] hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};
