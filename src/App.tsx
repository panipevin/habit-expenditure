import React from 'react';
import { CloudOff } from 'lucide-react';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { MobileNav } from './components/MobileNav';
import { BiometricLockScreen } from './components/BiometricLockScreen';
import { DashboardView } from './components/DashboardView';
import { TasksView } from './components/TasksView';
import { HabitsView } from './components/HabitsView';
import { BoardsView } from './components/BoardsView';
import { CalendarView } from './components/CalendarView';
import { ExpensesView } from './components/ExpensesView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';

const WorkspaceShell: React.FC = () => {
  const { activeSection, effectiveOnline, syncQueue, isVaultLocked } = useWorkspace();

  if (isVaultLocked) {
    return <BiometricLockScreen />;
  }

  return (
    <div className="min-h-screen flex bg-[#F6F7F9] dark:bg-[#0A0D14] text-[#0E1525] dark:text-[#F1F5F9]">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />

        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-24 lg:pb-10">
          {activeSection === 'dashboard' && <DashboardView />}
          {activeSection === 'tasks' && <TasksView />}
          {activeSection === 'habits' && <HabitsView />}
          {activeSection === 'boards' && <BoardsView />}
          {activeSection === 'calendar' && <CalendarView />}
          {activeSection === 'expenses' && <ExpensesView />}
          {activeSection === 'analytics' && <AnalyticsView />}
          {activeSection === 'settings' && <SettingsView />}
        </main>
      </div>

      <MobileNav />
      <BiometricLockScreen />

      {!effectiveOnline && (
        <div
          role="status"
          className="fixed bottom-18 lg:bottom-4 right-4 z-40 flex items-center gap-2 rounded-lg bg-[#0E1525] dark:bg-[#1E293B] border border-[#D97706]/60 px-3.5 py-2 text-xs font-medium text-white shadow-lg"
        >
          <CloudOff className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
          <span>
            Offline Mode — {syncQueue.length} change{syncQueue.length === 1 ? '' : 's'} queued for auto-sync
          </span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceProvider>
        <WorkspaceShell />
      </WorkspaceProvider>
    </ErrorBoundary>
  );
}
