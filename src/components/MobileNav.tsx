import React, { useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  Flame,
  LayoutGrid,
  Menu,
  Settings,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { AppSection } from '../types';

const PRIMARY_TABS: { id: AppSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutGrid },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'habits', label: 'Streaks', icon: Flame },
  { id: 'family', label: 'Family', icon: Users },
];

const MORE_DESTINATIONS: { id: AppSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'calendar', label: 'Calendar & Meetings', icon: CalendarDays },
  { id: 'expenses', label: 'Daily Expenses & CSV', icon: Wallet },
  { id: 'analytics', label: 'Progress Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Security, Sync & Widgets', icon: Settings },
];

export const MobileNav: React.FC = () => {
  const { activeSection, setActiveSection } = useWorkspace();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isMoreActive = MORE_DESTINATIONS.some((d) => d.id === activeSection);

  return (
    <>
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-xs flex items-end"
          role="dialog"
          aria-modal="true"
          aria-label="More workspace sections"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-white dark:bg-[#121722] border-t border-[#E2E6ED] dark:border-[#1F2737] p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[#CBD5E1] dark:bg-[#334155] rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                Workspace Tools
              </h2>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setDrawerOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#556075]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="divide-y divide-[#E2E6ED] dark:divide-[#1F2737]">
              {MORE_DESTINATIONS.map((dest) => {
                const Icon = dest.icon;
                const active = activeSection === dest.id;
                return (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(dest.id);
                      setDrawerOpen(false);
                    }}
                    className={`w-full min-h-[52px] flex items-center gap-3.5 text-left text-sm font-medium ${
                      active
                        ? 'text-[#1D4ED8] dark:text-[#60A5FA]'
                        : 'text-[#0E1525] dark:text-[#F1F5F9]'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{dest.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Mobile bottom navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-15 pb-safe bg-white/95 dark:bg-[#121722]/95 backdrop-blur-md border-t border-[#E2E6ED] dark:border-[#1F2737] grid grid-cols-5 items-center"
      >
        {PRIMARY_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveSection(tab.id);
                setDrawerOpen(false);
              }}
              aria-current={active ? 'page' : undefined}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 ${
                active
                  ? 'text-[#1D4ED8] dark:text-[#60A5FA]'
                  : 'text-[#556075] dark:text-[#8B97AD]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-tight">{tab.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setDrawerOpen((prev) => !prev)}
          aria-expanded={drawerOpen}
          aria-label="Open more sections"
          className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 ${
            isMoreActive || drawerOpen
              ? 'text-[#1D4ED8] dark:text-[#60A5FA]'
              : 'text-[#556075] dark:text-[#8B97AD]'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight">More</span>
        </button>
      </nav>
    </>
  );
};
