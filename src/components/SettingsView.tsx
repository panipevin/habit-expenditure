import React, { useEffect, useState } from 'react';
import {
  Bell,
  Cloud,
  CloudOff,
  Copy,
  Fingerprint,
  Lock,
  LogIn,
  LogOut,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  checkBiometricCapability,
  clearBiometricEnrollment,
  enrollBiometricPasskey,
  setPrivacyPin,
  type BiometricCapability,
} from '../lib/biometrics';
import {
  dispatchBrowserNotification,
  getNotificationPermission,
  requestNotificationPermission,
  type BrowserNotificationPermission,
} from '../lib/notifications';
import { formatHourLabel } from '../utils/dates';
import { PWAInstallButton } from './PWAInstallButton';

export const SettingsView: React.FC = () => {
  const {
    user,
    authError,
    signInWithGoogle,
    signOutUser,
    effectiveOnline,
    simulatedOffline,
    setSimulatedOffline,
    syncQueue,
    lastSyncedAt,
    flushSyncQueue,
    theme,
    toggleTheme,
    vaultLockEnabled,
    setVaultLockEnabled,
    lockVault,
    notificationPrefs,
    updateNotificationPrefs,
    pushAlert,
    clearWorkspaceData,
  } = useWorkspace();

  const [bioCap, setBioCap] = useState<BiometricCapability | null>(null);
  const [bioMessage, setBioMessage] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [uidCopied, setUidCopied] = useState(false);
  const [notifPerm, setNotifPerm] = useState<BrowserNotificationPermission>(() =>
    getNotificationPermission()
  );

  useEffect(() => {
    void checkBiometricCapability().then(setBioCap);
  }, []);

  const handleEnrollBiometric = async () => {
    const res = await enrollBiometricPasskey(user?.displayName || 'Cadence User');
    setBioMessage(res.message);
    const updated = await checkBiometricCapability();
    setBioCap(updated);
    if (res.ok) {
      setVaultLockEnabled(true);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.trim().length < 4) {
      setBioMessage('Privacy PIN must be at least 4 digits.');
      return;
    }
    await setPrivacyPin(newPin);
    setNewPin('');
    setVaultLockEnabled(true);
    setBioCap(await checkBiometricCapability());
    setBioMessage('Privacy PIN saved and vault lock armed.');
  };

  const handleDisableVault = async () => {
    clearBiometricEnrollment();
    setVaultLockEnabled(false);
    setBioCap(await checkBiometricCapability());
    setBioMessage('Biometric and PIN vault lock disabled.');
  };

  const handleRequestPush = async () => {
    const perm = await requestNotificationPermission();
    setNotifPerm(perm);
    if (perm === 'granted') {
      updateNotificationPrefs({ pushEnabled: true });
      dispatchBrowserNotification(
        'Cadence Push Reminders Active',
        'You will receive real-time urgent deadline and streak alerts.'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-[#556075] dark:text-[#8B97AD]">
          Biometric authentication · Cloud backup &amp; offline queue · Push notification controls
        </p>
        <h1 className="mt-1 font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0E1525] dark:text-[#F1F5F9]">
          Security &amp; Sync
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Biometric Authentication & Privacy Vault */}
        <section className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 space-y-5">
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#E2E6ED] dark:border-[#1F2737]">
            <div>
              <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                Biometric Privacy Vault
              </h2>
              <p className="mt-0.5 text-xs text-[#556075] dark:text-[#8B97AD]">
                Protect personal expenses, tasks, and streaks with WebAuthn Face ID / Touch ID or a SHA-256 Privacy PIN.
              </p>
            </div>
            <ShieldCheck
              className={`w-5 h-5 shrink-0 ${
                vaultLockEnabled ? 'text-[#16A34A]' : 'text-[#556075] dark:text-[#8B97AD]'
              }`}
            />
          </div>

          <div className="space-y-3 text-xs text-[#556075] dark:text-[#94A3B8]">
            <p>
              Platform biometric sensor:{' '}
              <strong className="text-[#0E1525] dark:text-[#F1F5F9]">
                {bioCap?.platformAuthenticator ? 'Available (WebAuthn Passkey)' : 'Fallback PIN mode ready'}
              </strong>
            </p>
            <p>
              Vault status:{' '}
              <strong className="text-[#0E1525] dark:text-[#F1F5F9]">
                {vaultLockEnabled ? 'Armed' : 'Off'}
              </strong>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleEnrollBiometric()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] dark:bg-[#3B82F6] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#1E40AF] dark:hover:bg-[#2563EB]"
            >
              <Fingerprint className="w-4 h-4" />
              Enroll Face ID / Touch ID
            </button>

            {vaultLockEnabled && (
              <>
                <button
                  type="button"
                  onClick={lockVault}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0E1525] dark:bg-[#F1F5F9] px-3.5 py-2 text-xs font-medium text-white dark:text-[#0E1525]"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Lock Now
                </button>
                <button
                  type="button"
                  onClick={() => void handleDisableVault()}
                  className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-3.5 py-2 text-xs font-medium text-[#DC2626] dark:text-[#F87171]"
                >
                  Disable Lock
                </button>
              </>
            )}
          </div>

          <form onSubmit={(e) => void handleSavePin(e)} className="pt-4 border-t border-[#E2E6ED] dark:border-[#1F2737] flex flex-col sm:flex-row gap-2">
            <label htmlFor="privacy-pin-setup" className="sr-only">
              Set 4 to 8 digit privacy PIN
            </label>
            <input
              id="privacy-pin-setup"
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="Set 4–8 digit fallback PIN"
              className="flex-1 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2 text-xs font-mono text-[#0E1525] dark:text-[#F1F5F9]"
            />
            <button
              type="submit"
              className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-3.5 py-2 text-xs font-medium text-[#0E1525] dark:text-[#F1F5F9] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130] whitespace-nowrap"
            >
              Save Privacy PIN
            </button>
          </form>

          {bioMessage && (
            <p className="text-xs font-medium text-[#1D4ED8] dark:text-[#60A5FA]">{bioMessage}</p>
          )}
        </section>

        {/* Cloud Sync, Offline Mode & Cross-Device PWA */}
        <section className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 space-y-5">
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#E2E6ED] dark:border-[#1F2737]">
            <div>
              <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                Cloud Sync &amp; Offline Resilience
              </h2>
              <p className="mt-0.5 text-xs text-[#556075] dark:text-[#8B97AD]">
                Firebase Cloud Firestore backup with IndexedDB offline caching and automatic reconnect sync.
              </p>
            </div>
            {effectiveOnline ? (
              <Cloud className="w-5 h-5 text-[#16A34A] shrink-0" />
            ) : (
              <CloudOff className="w-5 h-5 text-[#D97706] shrink-0" />
            )}
          </div>

          <div className="space-y-3">
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0E1525] dark:text-[#F1F5F9] truncate">
                      {user.displayName || 'Signed in user'}
                    </p>
                    <p className="text-xs text-[#556075] dark:text-[#8B97AD] truncate">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void signOutUser()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-3.5 py-2 text-xs font-medium text-[#0E1525] dark:text-[#F1F5F9]"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2 text-xs">
                  <span className="text-[#556075] dark:text-[#94A3B8] truncate font-mono">
                    Share UID: {user.uid}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(user.uid);
                      setUidCopied(true);
                      setTimeout(() => setUidCopied(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 text-[#1D4ED8] dark:text-[#60A5FA] font-medium whitespace-nowrap shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {uidCopied ? 'Copied' : 'Copy UID'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-[#556075] dark:text-[#94A3B8]">
                  Connect your Google account to sync tasks, habits, and boards across desktop, iOS, and Android.
                </p>
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0E1525] dark:bg-[#F1F5F9] px-4 py-2 text-xs font-medium text-white dark:text-[#0E1525] whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign in with Google
                </button>
              </div>
            )}
            {authError && <p className="text-xs text-[#DC2626]">{authError}</p>}
          </div>

          <div className="pt-4 border-t border-[#E2E6ED] dark:border-[#1F2737] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#556075] dark:text-[#94A3B8]">Connectivity state</span>
              <span className="font-medium text-[#0E1525] dark:text-[#F1F5F9]">
                {effectiveOnline ? 'Online · Auto-sync active' : `Offline · ${syncQueue.length} queued`}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#556075] dark:text-[#94A3B8]">Last synchronized</span>
              <span className="font-mono tabular-nums text-[#0E1525] dark:text-[#F1F5F9]">
                {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSimulatedOffline(!simulatedOffline)}
                className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-3.5 py-2 text-xs font-medium text-[#0E1525] dark:text-[#F1F5F9] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130]"
              >
                {simulatedOffline ? 'Restore Connection & Sync' : 'Work Offline (Test Queue)'}
              </button>
              {syncQueue.length > 0 && effectiveOnline && (
                <button
                  type="button"
                  onClick={flushSyncQueue}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3.5 py-2 text-xs font-medium text-white"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sync {syncQueue.length} Queued
                </button>
              )}
              <PWAInstallButton />
            </div>

            <div className="pt-3 border-t border-[#E2E6ED] dark:border-[#1F2737] flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[#556075] dark:text-[#8B97AD]">
                Clear local cached tasks, habits, boards, and expenses
              </span>
              {confirmReset ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-3 py-1.5 text-xs font-medium text-[#556075]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearWorkspaceData();
                      setConfirmReset(false);
                    }}
                    className="rounded-lg bg-[#DC2626] px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Confirm Clear All
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-3 py-1.5 text-xs font-medium text-[#DC2626] dark:text-[#F87171] hover:bg-[#FEE2E2]/40 dark:hover:bg-[#7F1D1D]/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Local Data
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Customizable Notification Preferences */}
        <section className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#E2E6ED] dark:border-[#1F2737]">
            <div>
              <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                Notification &amp; Reminder Preferences
              </h2>
              <p className="mt-0.5 text-xs text-[#556075] dark:text-[#8B97AD]">
                Customize real-time push alerts for urgent deadlines, pre-night task planning, and habit streaks.
              </p>
            </div>
            <Bell className="w-5 h-5 text-[#1D4ED8] dark:text-[#60A5FA] shrink-0" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2E6ED] dark:border-[#1F2737]">
            <span className="text-xs text-[#556075] dark:text-[#94A3B8]">
              Browser Push Status: <strong className="text-[#0E1525] dark:text-[#F1F5F9]">{notifPerm}</strong>
            </span>
            <div className="flex gap-2">
              {notifPerm !== 'granted' && notifPerm !== 'unsupported' && (
                <button
                  type="button"
                  onClick={() => void handleRequestPush()}
                  className="rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-xs font-medium text-white"
                >
                  Enable Push Alerts
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  pushAlert(
                    'Urgent Deadline Reminder Test',
                    'Real-time push notifications and in-app alerts are active.',
                    'deadline'
                  )
                }
                className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-3 py-1.5 text-xs font-medium text-[#0E1525] dark:text-[#F1F5F9]"
              >
                Send Test Alert
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="cutoff-hour-select" className="text-xs font-medium text-[#0E1525] dark:text-[#F1F5F9]">
                Evening task planning cutoff
              </label>
              <select
                id="cutoff-hour-select"
                value={notificationPrefs.eveningCutoffHour}
                onChange={(e) =>
                  updateNotificationPrefs({ eveningCutoffHour: Number(e.target.value) })
                }
                className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-2.5 py-1.5 text-xs font-mono text-[#0E1525] dark:text-[#F1F5F9]"
              >
                {[18, 19, 20, 21, 22, 23].map((h) => (
                  <option key={h} value={h}>
                    {formatHourLabel(h)}
                  </option>
                ))}
              </select>
            </div>

            {(
              [
                { key: 'urgentDeadlines', label: 'Urgent deadline push reminders' },
                { key: 'eveningCutoffReminder', label: 'Pre-night daily task assignment alert' },
                { key: 'streakRiskAlerts', label: 'Habit streak risk & milestone notifications' },
                { key: 'teamMentions', label: 'Team board status & discussion alerts' },
                { key: 'budgetThresholdAlerts', label: 'Monthly budget threshold warnings' },
              ] as const
            ).map((pref) => (
              <label
                key={pref.key}
                className="flex items-center justify-between gap-3 py-1 text-xs text-[#0E1525] dark:text-[#E2E8F0] cursor-pointer"
              >
                <span>{pref.label}</span>
                <input
                  type="checkbox"
                  checked={notificationPrefs[pref.key]}
                  onChange={(e) => updateNotificationPrefs({ [pref.key]: e.target.checked })}
                  className="rounded border-[#CBD5E1] text-[#1D4ED8] focus:ring-[#1D4ED8]"
                />
              </label>
            ))}
          </div>
        </section>

        {/* Appearance & Theme */}
        <section className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 space-y-4">
          <div className="pb-4 border-b border-[#E2E6ED] dark:border-[#1F2737]">
            <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
              Appearance
            </h2>
            <p className="mt-0.5 text-xs text-[#556075] dark:text-[#8B97AD]">
              Switch between Nordic Light and low-light Obsidian Dark mode.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#0E1525] dark:text-[#F1F5F9]">
                Active Theme: {theme === 'dark' ? 'Obsidian Dark' : 'Architectural Light'}
              </p>
              <p className="text-xs text-[#556075] dark:text-[#8B97AD]">
                Calibrated contrast ratios for day and evening planning sessions.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-4 py-2 text-xs font-medium text-[#0E1525] dark:text-[#F1F5F9] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130]"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
