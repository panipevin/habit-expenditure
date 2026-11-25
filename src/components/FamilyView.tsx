import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Eye,
  KeyRound,
  Link2,
  LogIn,
  ShieldCheck,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { normalizeShareInviteCode } from '../utils/sharing';

export const FamilyView: React.FC = () => {
  const {
    user,
    authError,
    signInWithGoogle,
    effectiveOnline,
    viewingAccountId,
    setViewingAccountId,
    setActiveSection,
    connectedAccounts,
    myViewers,
    activeInvite,
    createShareInvite,
    cancelShareInvite,
    connectWithInviteCode,
    revokeViewerAccess,
  } = useWorkspace();

  const [codeInput, setCodeInput] = useState('');
  const [busyGenerate, setBusyGenerate] = useState(false);
  const [busyConnect, setBusyConnect] = useState(false);
  const [revokingUid, setRevokingUid] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleGenerateCode = async () => {
    setBusyGenerate(true);
    setStatusMessage(null);
    const res = await createShareInvite();
    setBusyGenerate(false);
    if (!res.ok) {
      setStatusMessage({ type: 'error', text: res.error || 'Could not create share code.' });
    } else if (res.code) {
      setStatusMessage({
        type: 'success',
        text: `Share code ${res.code} is ready. Send it to your family member so they can enter it on their phone.`,
      });
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard?.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable in restricted contexts
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyConnect(true);
    setStatusMessage(null);
    const res = await connectWithInviteCode(codeInput);
    setBusyConnect(false);
    if (!res.ok) {
      setStatusMessage({ type: 'error', text: res.error || 'Could not link account.' });
      return;
    }
    setCodeInput('');
    setStatusMessage({
      type: 'success',
      text: `Linked with ${res.connectedName}. Their account will appear below as soon as their device syncs.`,
    });
  };

  const handleViewAccount = (
    ownerId: string,
    destination: 'dashboard' | 'tasks' | 'habits' | 'expenses' = 'dashboard'
  ) => {
    setViewingAccountId(ownerId);
    setActiveSection(destination);
  };

  const handleRevoke = async (uid: string, name: string) => {
    setRevokingUid(uid);
    await revokeViewerAccess(uid);
    setRevokingUid(null);
    setStatusMessage({
      type: 'success',
      text: `Removed read-only access for ${name}. They can no longer view your account.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#556075] dark:text-[#8B97AD]">
            Multi-user read-only sharing · Separate logins on each phone, zero cross-account editing
          </p>
          <h1 className="mt-1 font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0E1525] dark:text-[#F1F5F9]">
            Family &amp; Connected Accounts
          </h1>
        </div>

        {viewingAccountId && (
          <button
            type="button"
            onClick={() => {
              setViewingAccountId(null);
              setActiveSection('dashboard');
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0E1525] dark:bg-[#F1F5F9] px-4 py-2 text-xs font-medium text-white dark:text-[#0E1525] hover:opacity-90 whitespace-nowrap shrink-0"
          >
            Switch Back to My Account
          </button>
        )}
      </div>

      {/* Privacy & Read-Only Guarantee Banner */}
      <section className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-5 flex items-start gap-3.5">
        <ShieldCheck className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-[#556075] dark:text-[#94A3B8] leading-relaxed">
          <p className="text-sm font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
            View everything live — strictly read-only
          </p>
          <p>
            Sign in with your own Google account on each phone (for example, you on your phone and your sister on hers). Once linked with a 6-character Share Code, you can view each other&apos;s Daily Tasks, Habit Streaks, Calendar, Expenses, Budgets, and Analytics — while neither person can ever edit, delete, or change the other&apos;s account details or private security settings.
          </p>
        </div>
      </section>

      {!user ? (
        /* Signed-Out Prompt */
        <section className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-8 sm:p-10 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-[#1D4ED8]/10 text-[#1D4ED8] dark:text-[#60A5FA] flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="font-display text-lg font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
              Sign in on each phone to connect accounts
            </h2>
            <p className="text-xs text-[#556075] dark:text-[#94A3B8] leading-relaxed">
              Each person signs in with their own Google account. Your tasks, habits, and expenses stay owned by your account and sync securely in real time.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D4ED8] dark:bg-[#3B82F6] px-5 py-2.5 text-xs font-medium text-white hover:bg-[#1E40AF] dark:hover:bg-[#2563EB] transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Sign in with Google
          </button>
          {authError && <p className="text-xs font-medium text-[#DC2626]">{authError}</p>}
        </section>
      ) : (
        <>
          {statusMessage && (
            <div
              role="status"
              className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-3 text-xs font-medium ${
                statusMessage.type === 'error'
                  ? 'border-[#DC2626]/40 bg-[#FEE2E2]/50 dark:bg-[#7F1D1D]/25 text-[#B91C1C] dark:text-[#FCA5A5]'
                  : 'border-[#16A34A]/35 bg-[#16A34A]/10 text-[#15803D] dark:text-[#4ADE80]'
              }`}
            >
              <span>{statusMessage.text}</span>
              <button
                type="button"
                aria-label="Dismiss message"
                onClick={() => setStatusMessage(null)}
                className="shrink-0 opacity-70 hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Connected Accounts You Can View (Read-Only) */}
          <section className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E2E6ED] dark:border-[#1F2737]">
              <div>
                <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                  Accounts You Can View ({connectedAccounts.length})
                </h2>
                <p className="mt-0.5 text-xs text-[#556075] dark:text-[#8B97AD]">
                  Open any linked family account to inspect their tasks, habits, calendar, expenses, and analytics in read-only mode.
                </p>
              </div>
              <Eye className="w-5 h-5 text-[#1D4ED8] dark:text-[#60A5FA] shrink-0" />
            </div>

            {connectedAccounts.length === 0 ? (
              <div className="py-8 text-center space-y-1.5">
                <p className="text-sm font-medium text-[#0E1525] dark:text-[#F1F5F9]">
                  No connected family accounts yet
                </p>
                <p className="text-xs text-[#556075] dark:text-[#8B97AD] max-w-md mx-auto">
                  Generate a 6-character Share Code below and send it to your sister, or enter the code she generated on her phone.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {connectedAccounts.map((acc) => {
                  const isCurrentlyViewing = viewingAccountId === acc.ownerId;
                  return (
                    <article
                      key={acc.ownerId}
                      className={`rounded-xl border p-4 space-y-4 transition-colors ${
                        isCurrentlyViewing
                          ? 'border-[#1D4ED8] bg-[#1D4ED8]/5 dark:border-[#3B82F6] dark:bg-[#3B82F6]/10'
                          : 'border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9]/60 dark:bg-[#0A0D14]/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-10 h-10 rounded-full bg-[#1D4ED8]/15 dark:bg-[#3B82F6]/20 text-[#1D4ED8] dark:text-[#93C5FD] flex items-center justify-center text-xs font-semibold shrink-0">
                            {acc.displayName.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#0E1525] dark:text-[#F1F5F9] truncate">
                              {acc.displayName}
                            </p>
                            <p className="text-xs text-[#556075] dark:text-[#8B97AD]">
                              Read-Only Access · {acc.expenseCategories.length} budget categories
                            </p>
                          </div>
                        </div>
                        {isCurrentlyViewing && (
                          <span className="text-[11px] font-semibold text-[#1D4ED8] dark:text-[#60A5FA] whitespace-nowrap">
                            Viewing Now
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleViewAccount(acc.ownerId, 'dashboard')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] dark:bg-[#3B82F6] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#1E40AF] dark:hover:bg-[#2563EB] transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Everything
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleViewAccount(acc.ownerId, 'tasks')}
                          className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-white dark:bg-[#121722] px-3 py-2 text-xs font-medium text-[#0E1525] dark:text-[#F1F5F9] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130]"
                        >
                          Tasks
                        </button>
                        <button
                          type="button"
                          onClick={() => handleViewAccount(acc.ownerId, 'habits')}
                          className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-white dark:bg-[#121722] px-3 py-2 text-xs font-medium text-[#0E1525] dark:text-[#F1F5F9] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130]"
                        >
                          Habits
                        </button>
                        <button
                          type="button"
                          onClick={() => handleViewAccount(acc.ownerId, 'expenses')}
                          className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-white dark:bg-[#121722] px-3 py-2 text-xs font-medium text-[#0E1525] dark:text-[#F1F5F9] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130]"
                        >
                          Expenses
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* 2-Column Link Flow: Generate Code vs Enter Code */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Step 1: Generate a Share Code */}
            <section className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 space-y-4">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#E2E6ED] dark:border-[#1F2737]">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                    1. Invite a Family Member
                  </h2>
                  <p className="mt-0.5 text-xs text-[#556075] dark:text-[#8B97AD]">
                    Create a one-time 6-character code and share it with the other phone.
                  </p>
                </div>
                <KeyRound className="w-5 h-5 text-[#1D4ED8] dark:text-[#60A5FA] shrink-0" />
              </div>

              {activeInvite ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-[#1D4ED8]/35 bg-[#F6F7F9] dark:bg-[#0A0D14] p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium text-[#556075] dark:text-[#8B97AD]">
                        Active one-time Share Code
                      </p>
                      <p className="mt-0.5 font-mono text-2xl font-bold tracking-[0.22em] text-[#0E1525] dark:text-[#F1F5F9]">
                        {activeInvite.code}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopyCode(activeInvite.code)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] dark:bg-[#3B82F6] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#1E40AF]"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy Code'}
                    </button>
                  </div>
                  <p className="text-xs text-[#556075] dark:text-[#94A3B8]">
                    Waiting for them to enter this code on their phone. Once entered, both accounts connect automatically in read-only mode.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busyGenerate || !effectiveOnline}
                      onClick={() => void handleGenerateCode()}
                      className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-3 py-1.5 text-xs font-medium text-[#0E1525] dark:text-[#F1F5F9] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130] disabled:opacity-50"
                    >
                      Generate New Code
                    </button>
                    <button
                      type="button"
                      onClick={() => void cancelShareInvite()}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#DC2626] dark:text-[#F87171] hover:bg-[#FEE2E2]/40 dark:hover:bg-[#7F1D1D]/20"
                    >
                      Cancel Code
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[#556075] dark:text-[#94A3B8] leading-relaxed">
                    Generate a temporary code on your phone. When your sister enters it on her phone, both of you will immediately get read-only access to each other&apos;s workspace.
                  </p>
                  <button
                    type="button"
                    disabled={busyGenerate || !effectiveOnline}
                    onClick={() => void handleGenerateCode()}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0E1525] dark:bg-[#F1F5F9] px-4 py-2.5 text-xs font-medium text-white dark:text-[#0E1525] hover:opacity-90 disabled:opacity-50"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    {busyGenerate ? 'Generating...' : 'Generate 6-Character Share Code'}
                  </button>
                </div>
              )}
            </section>

            {/* Step 2: Enter a Share Code */}
            <section className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 space-y-4">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#E2E6ED] dark:border-[#1F2737]">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                    2. Enter a Family Share Code
                  </h2>
                  <p className="mt-0.5 text-xs text-[#556075] dark:text-[#8B97AD]">
                    Received a code from another phone? Enter it here to connect both accounts.
                  </p>
                </div>
                <Link2 className="w-5 h-5 text-[#1D4ED8] dark:text-[#60A5FA] shrink-0" />
              </div>

              <form onSubmit={(e) => void handleConnect(e)} className="space-y-3">
                <div>
                  <label
                    htmlFor="family-share-code"
                    className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1"
                  >
                    6-Character Share Code
                  </label>
                  <input
                    id="family-share-code"
                    type="text"
                    maxLength={16}
                    value={codeInput}
                    onChange={(e) => setCodeInput(normalizeShareInviteCode(e.target.value))}
                    placeholder="e.g. K7M4P9"
                    className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3.5 py-2.5 text-sm font-mono uppercase tracking-[0.2em] text-[#0E1525] dark:text-[#F1F5F9] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busyConnect || !effectiveOnline || codeInput.length < 6}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#1D4ED8] dark:bg-[#3B82F6] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#1E40AF] dark:hover:bg-[#2563EB] disabled:opacity-50"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  {busyConnect ? 'Connecting...' : 'Connect Accounts (Read-Only)'}
                </button>
              </form>
            </section>
          </div>

          {/* Who Can View My Account */}
          <section className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 space-y-4">
            <div className="pb-3 border-b border-[#E2E6ED] dark:border-[#1F2737]">
              <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                Who Can View My Account ({myViewers.length})
              </h2>
              <p className="mt-0.5 text-xs text-[#556075] dark:text-[#8B97AD]">
                People listed below have strict read-only visibility into your tasks, habits, calendar, and expenses. You can revoke access at any time.
              </p>
            </div>

            {myViewers.length === 0 ? (
              <p className="py-4 text-xs text-[#556075] dark:text-[#8B97AD]">
                Only you can currently view your account.
              </p>
            ) : (
              <div className="divide-y divide-[#E2E6ED] dark:divide-[#1F2737]">
                {myViewers.map((viewer) => (
                  <div
                    key={viewer.uid}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-full bg-[#16A34A]/15 text-[#15803D] dark:text-[#4ADE80] flex items-center justify-center text-xs font-semibold shrink-0">
                        {viewer.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0E1525] dark:text-[#F1F5F9] truncate">
                          {viewer.name}
                        </p>
                        <p className="text-xs text-[#556075] dark:text-[#8B97AD]">
                          Read-only viewer · Cannot edit or delete your records
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={revokingUid === viewer.uid}
                      onClick={() => void handleRevoke(viewer.uid, viewer.name)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-3 py-1.5 text-xs font-medium text-[#DC2626] dark:text-[#F87171] hover:bg-[#FEE2E2]/40 dark:hover:bg-[#7F1D1D]/20 whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      {revokingUid === viewer.uid ? 'Removing...' : 'Revoke Access'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
