import React, { useEffect, useState } from 'react';
import { Fingerprint, Lock, ShieldCheck } from 'lucide-react';
import {
  checkBiometricCapability,
  verifyBiometricPasskey,
  verifyPrivacyPin,
  type BiometricCapability,
} from '../lib/biometrics';
import { useWorkspace } from '../context/WorkspaceContext';

export const BiometricLockScreen: React.FC = () => {
  const { isVaultLocked, unlockVault } = useWorkspace();
  const [capability, setCapability] = useState<BiometricCapability | null>(null);
  const [pin, setPin] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (isVaultLocked) {
      void checkBiometricCapability().then(setCapability);
    }
  }, [isVaultLocked]);

  if (!isVaultLocked) return null;

  const handleBiometricUnlock = async () => {
    setVerifying(true);
    setStatusMessage(null);
    const res = await verifyBiometricPasskey();
    setVerifying(false);
    if (res.ok) {
      unlockVault();
    } else {
      setStatusMessage(res.message);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setStatusMessage('Enter your 4-6 digit privacy PIN.');
      return;
    }
    const ok = await verifyPrivacyPin(pin);
    if (ok) {
      setPin('');
      setStatusMessage(null);
      unlockVault();
    } else {
      setStatusMessage('Incorrect privacy PIN. Try again.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#F6F7F9] dark:bg-[#0A0D14] p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-lock-heading"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-7">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#1D4ED8]/10 dark:bg-[#3B82F6]/15 text-[#1D4ED8] dark:text-[#60A5FA] mx-auto">
          <Lock className="w-6 h-6" />
        </div>

        <h1
          id="vault-lock-heading"
          className="mt-5 text-center font-display text-xl font-semibold text-[#0E1525] dark:text-[#F1F5F9]"
        >
          Cadence Privacy Vault
        </h1>
        <p className="mt-2 text-center text-sm text-[#556075] dark:text-[#94A3B8]">
          Verify your identity to access personal expenses, habit streaks, and daily tasks.
        </p>

        {capability?.enrolled && (
          <button
            type="button"
            disabled={verifying}
            onClick={() => void handleBiometricUnlock()}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] dark:bg-[#3B82F6] px-4 py-3 text-sm font-medium text-white hover:bg-[#1E40AF] dark:hover:bg-[#2563EB] transition-colors disabled:opacity-60"
          >
            <Fingerprint className="w-5 h-5" />
            {verifying ? 'Verifying Biometrics...' : 'Unlock with Face ID / Touch ID'}
          </button>
        )}

        {capability?.hasPinFallback && (
          <form onSubmit={(e) => void handlePinSubmit(e)} className="mt-5 space-y-3">
            <label
              htmlFor="vault-pin-input"
              className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8]"
            >
              Privacy PIN
            </label>
            <input
              id="vault-pin-input"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3.5 py-2.5 text-center font-mono text-base tracking-[0.25em] text-[#0E1525] dark:text-[#F1F5F9] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
            />
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0E1525] dark:bg-[#F1F5F9] px-4 py-2.5 text-sm font-medium text-white dark:text-[#0E1525] hover:opacity-90 transition-opacity"
            >
              <ShieldCheck className="w-4 h-4" />
              Unlock Workspace
            </button>
          </form>
        )}

        {!capability?.enrolled && !capability?.hasPinFallback && (
          <button
            type="button"
            onClick={unlockVault}
            className="mt-6 w-full rounded-lg bg-[#1D4ED8] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1E40AF] transition-colors"
          >
            Continue to Workspace
          </button>
        )}

        {statusMessage && (
          <p className="mt-4 text-center text-xs font-medium text-[#DC2626] dark:text-[#F87171]">
            {statusMessage}
          </p>
        )}
      </div>
    </div>
  );
};
