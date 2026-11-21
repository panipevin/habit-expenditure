import React, { useState } from 'react';
import { MessageSquare, Plus, Send, Users } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { BoardStatus, TaskPriority } from '../types';
import { formatShortDate } from '../utils/dates';

const COLUMNS: { id: BoardStatus; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];

export const BoardsView: React.FC = () => {
  const {
    todayISO,
    boards,
    addBoard,
    addBoardItem,
    moveBoardItemStatus,
    addBoardComment,
  } = useWorkspace();

  const [selectedBoardId, setSelectedBoardId] = useState(boards[0]?.id || '');
  const activeBoard = boards.find((b) => b.id === selectedBoardId) || boards[0];

  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [boardDesc, setBoardDesc] = useState('');

  const [newCardOpen, setNewCardOpen] = useState(false);
  const [cardTitle, setCardTitle] = useState('');
  const [cardPriority, setCardPriority] = useState<TaskPriority>('medium');
  const [cardAssignee, setCardAssignee] = useState(activeBoard?.members[0]?.name || 'Maya Chen');
  const [cardDueDate, setCardDueDate] = useState(todayISO);

  const [commentText, setCommentText] = useState('');

  const handleCreateBoard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardName.trim()) return;
    addBoard(boardName, boardDesc);
    setBoardName('');
    setBoardDesc('');
    setNewBoardOpen(false);
  };

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBoard || !cardTitle.trim()) return;
    addBoardItem(activeBoard.id, {
      title: cardTitle,
      priority: cardPriority,
      assigneeName: cardAssignee,
      dueDate: cardDueDate,
    });
    setCardTitle('');
    setNewCardOpen(false);
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBoard || !commentText.trim()) return;
    addBoardComment(activeBoard.id, commentText);
    setCommentText('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#556075] dark:text-[#8B97AD]">
            Multi-user shared workspaces · Real-time status updates &amp; internal team discussion
          </p>
          <h1 className="mt-1 font-display text-2xl lg:text-3xl font-semibold tracking-tight text-[#0E1525] dark:text-[#F1F5F9]">
            Team Boards
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNewBoardOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-white dark:bg-[#121722] px-3.5 py-2 text-xs font-medium text-[#0E1525] dark:text-[#F1F5F9] hover:bg-[#F6F7F9] dark:hover:bg-[#1A2130] whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            New Board
          </button>
          <button
            type="button"
            onClick={() => setNewCardOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] dark:bg-[#3B82F6] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#1E40AF] dark:hover:bg-[#2563EB] whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Card
          </button>
        </div>
      </div>

      {/* Board Switcher & Team Roster */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#E9EDF3] dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] self-start overflow-x-auto max-w-full">
          {boards.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedBoardId(b.id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeBoard?.id === b.id
                  ? 'bg-white dark:bg-[#1F2737] text-[#0E1525] dark:text-[#F1F5F9] shadow-2xs'
                  : 'text-[#556075] dark:text-[#8B97AD] hover:text-[#0E1525] dark:hover:text-[#F1F5F9]'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>

        {activeBoard && (
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {activeBoard.members.map((m) => (
                <img
                  key={m.id}
                  src={m.avatarUrl}
                  alt={`${m.name} (${m.role})`}
                  title={`${m.name} — ${m.role}`}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-[#F6F7F9] dark:ring-[#0A0D14]"
                />
              ))}
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-[#556075] dark:text-[#94A3B8]">
              <Users className="w-3.5 h-3.5" />
              {activeBoard.members.length} team members
            </span>
          </div>
        )}
      </div>

      {/* New Board Form */}
      {newBoardOpen && (
        <form
          onSubmit={handleCreateBoard}
          className="rounded-xl bg-white dark:bg-[#121722] border border-[#1D4ED8]/40 p-5 grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
        >
          <div>
            <label htmlFor="board-name-input" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
              Board name
            </label>
            <input
              id="board-name-input"
              type="text"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              placeholder="e.g. Q1 Growth Launch"
              className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2 text-sm text-[#0E1525] dark:text-[#F1F5F9]"
            />
          </div>
          <div>
            <label htmlFor="board-desc-input" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
              Description
            </label>
            <input
              id="board-desc-input"
              type="text"
              value={boardDesc}
              onChange={(e) => setBoardDesc(e.target.value)}
              placeholder="Scope and deliverables"
              className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2 text-sm text-[#0E1525] dark:text-[#F1F5F9]"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setNewBoardOpen(false)}
              className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-3.5 py-2 text-xs font-medium text-[#556075]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0E1525] dark:bg-[#F1F5F9] px-4 py-2 text-xs font-medium text-white dark:text-[#0E1525]"
            >
              Create Board
            </button>
          </div>
        </form>
      )}

      {/* New Card Form */}
      {newCardOpen && activeBoard && (
        <form
          onSubmit={handleAddCard}
          className="rounded-xl bg-white dark:bg-[#121722] border border-[#1D4ED8]/40 p-5 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
        >
          <div className="md:col-span-2">
            <label htmlFor="card-title-input" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
              Card title
            </label>
            <input
              id="card-title-input"
              type="text"
              value={cardTitle}
              onChange={(e) => setCardTitle(e.target.value)}
              placeholder="e.g. Ship Android maskable icon verification"
              className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2 text-sm text-[#0E1525] dark:text-[#F1F5F9]"
            />
          </div>
          <div>
            <label htmlFor="card-assignee-select" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
              Assignee
            </label>
            <select
              id="card-assignee-select"
              value={cardAssignee}
              onChange={(e) => setCardAssignee(e.target.value)}
              className="w-full rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3 py-2 text-sm text-[#0E1525] dark:text-[#F1F5F9]"
            >
              {activeBoard.members.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
              <option value="You">You</option>
            </select>
          </div>
          <div>
            <label htmlFor="card-priority-select" className="block text-xs font-medium text-[#556075] dark:text-[#94A3B8] mb-1">
              Priority &amp; Due
            </label>
            <div className="flex gap-2">
              <select
                id="card-priority-select"
                value={cardPriority}
                onChange={(e) => setCardPriority(e.target.value as TaskPriority)}
                className="flex-1 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-2 py-2 text-xs text-[#0E1525] dark:text-[#F1F5F9]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <input
                type="date"
                aria-label="Card due date"
                value={cardDueDate}
                onChange={(e) => setCardDueDate(e.target.value)}
                className="w-32 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-2 py-2 text-xs font-mono text-[#0E1525] dark:text-[#F1F5F9]"
              />
            </div>
          </div>
          <div className="md:col-span-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNewCardOpen(false)}
              className="rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] px-3.5 py-2 text-xs font-medium text-[#556075]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#0E1525] dark:bg-[#F1F5F9] px-4 py-2 text-xs font-medium text-white dark:text-[#0E1525]"
            >
              Add to Backlog
            </button>
          </div>
        </form>
      )}

      {/* Kanban Columns */}
      {activeBoard && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colItems = activeBoard.items.filter((i) => i.status === col.id);
            return (
              <section
                key={col.id}
                aria-label={`${col.label} column`}
                className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E6ED] dark:border-[#1F2737]">
                  <h2 className="font-display text-sm font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                    {col.label}
                  </h2>
                  <span className="font-mono text-xs tabular-nums text-[#556075] dark:text-[#8B97AD]">
                    {colItems.length}
                  </span>
                </div>

                {colItems.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[#6B768B] dark:text-[#64748B]">
                    No items in {col.label.toLowerCase()}
                  </p>
                ) : (
                  <div className="divide-y divide-[#E2E6ED] dark:divide-[#1F2737]">
                    {colItems.map((item) => (
                      <div key={item.id} className="py-3 first:pt-0 last:pb-0 space-y-2.5">
                        <p className="text-sm font-medium text-[#0E1525] dark:text-[#F1F5F9] leading-snug">
                          {item.title}
                        </p>
                        <div className="flex items-center justify-between gap-2 text-xs text-[#556075] dark:text-[#8B97AD]">
                          <span className="flex items-center gap-1.5 truncate">
                            {item.assigneeAvatar && (
                              <img
                                src={item.assigneeAvatar}
                                alt={item.assigneeName}
                                referrerPolicy="no-referrer"
                                className="w-5 h-5 rounded-full object-cover shrink-0"
                              />
                            )}
                            <span className="truncate">{item.assigneeName}</span>
                          </span>
                          <span className="font-mono tabular-nums shrink-0">
                            {formatShortDate(item.dueDate)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[11px] font-medium ${
                              item.priority === 'urgent'
                                ? 'text-[#DC2626] dark:text-[#F87171]'
                                : item.priority === 'high'
                                ? 'text-[#D97706] dark:text-[#FBBF24]'
                                : 'text-[#556075] dark:text-[#8B97AD]'
                            }`}
                          >
                            {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                          </span>
                          <select
                            aria-label={`Move "${item.title}" to column`}
                            value={item.status}
                            onChange={(e) =>
                              moveBoardItemStatus(activeBoard.id, item.id, e.target.value as BoardStatus)
                            }
                            className="h-7 rounded border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-2 text-[11px] text-[#0E1525] dark:text-[#F1F5F9]"
                          >
                            {COLUMNS.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Real-Time Team Communication Feed */}
      {activeBoard && (
        <section
          aria-label="Team board discussion feed"
          className="rounded-xl bg-white dark:bg-[#121722] border border-[#E2E6ED] dark:border-[#1F2737] p-6 space-y-4"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-[#E2E6ED] dark:border-[#1F2737]">
            <MessageSquare className="w-4 h-4 text-[#1D4ED8] dark:text-[#60A5FA]" />
            <h2 className="font-display text-base font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
              Team Updates — {activeBoard.name}
            </h2>
          </div>

          <div className="divide-y divide-[#E2E6ED] dark:divide-[#1F2737]">
            {activeBoard.comments.length === 0 ? (
              <p className="py-4 text-xs text-[#556075] dark:text-[#8B97AD]">
                No updates posted yet. Share a status note with your collaborators.
              </p>
            ) : (
              activeBoard.comments.map((c) => (
                <div key={c.id} className="py-3 flex items-start gap-3">
                  {c.authorAvatar ? (
                    <img
                      src={c.authorAvatar}
                      alt={c.authorName}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                    />
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-[#1D4ED8]/15 text-[#1D4ED8] dark:text-[#93C5FD] flex items-center justify-center text-[11px] font-semibold shrink-0 mt-0.5">
                      {c.authorName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#0E1525] dark:text-[#F1F5F9]">
                      {c.authorName}
                      <span className="ml-2 font-normal text-[#556075] dark:text-[#8B97AD] font-mono">
                        {formatShortDate(c.createdAt.slice(0, 10))}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
                      {c.body}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handlePostComment} className="flex gap-2 pt-2">
            <label htmlFor="board-comment-input" className="sr-only">
              Post a team update
            </label>
            <input
              id="board-comment-input"
              type="text"
              maxLength={400}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Post a real-time status update to the team..."
              className="flex-1 rounded-lg border border-[#E2E6ED] dark:border-[#1F2737] bg-[#F6F7F9] dark:bg-[#0A0D14] px-3.5 py-2.5 text-sm text-[#0E1525] dark:text-[#F1F5F9]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0E1525] dark:bg-[#F1F5F9] px-4 py-2.5 text-xs font-medium text-white dark:text-[#0E1525] hover:opacity-90 whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              Post Update
            </button>
          </form>
        </section>
      )}
    </div>
  );
};
