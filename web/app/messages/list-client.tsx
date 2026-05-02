"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eraser, MessageSquarePlus, Search, X } from "lucide-react";
import { PlayerAvatar } from "@/components/bdl/player-avatar";
import { clearAllConversations } from "@/lib/actions/messages";
import type {
  ConversationListItem,
  MessageablePlayer,
} from "@/lib/queries/messages";

const fmtRelative = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

const initials = (first: string, last: string): string =>
  `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();

export function MessagesListClient({
  conversations,
  messageable,
  viewerId,
}: {
  conversations: ConversationListItem[];
  messageable: MessageablePlayer[];
  viewerId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const onClearAll = () => {
    setConfirmClear(false);
    start(async () => {
      await clearAllConversations();
      router.refresh();
    });
  };

  const filteredPicker = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    // Hide players who already have an active conversation in the list
    // — picker is for starting NEW threads. Existing ones are right
    // there in the list.
    const existingIds = new Set(conversations.map((c) => c.otherPlayerId));
    let pool = messageable.filter((p) => !existingIds.has(p.id));
    if (q) {
      pool = pool.filter(
        (p) =>
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q),
      );
    }
    return pool.slice(0, 60);
  }, [pickerQuery, messageable, conversations]);

  return (
    <>
      <div className="flex justify-end gap-2 -mt-1">
        {conversations.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11.5px] font-semibold tracking-[0.04em] uppercase border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[color:var(--text-3)] hover:text-[color:var(--text)] disabled:opacity-60"
          >
            <Eraser size={12} /> Clear recent
          </button>
        )}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11.5px] font-semibold tracking-[0.04em] uppercase bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white"
        >
          <MessageSquarePlus size={12} /> New message
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-12 text-center text-[color:var(--text-3)] text-[14px]">
          No conversations yet. Tap{" "}
          <span className="font-semibold text-[color:var(--text-2)]">
            New message
          </span>{" "}
          to start one.
        </div>
      ) : (
        <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
          {conversations.map((c) => {
            const isMine = c.lastSenderId === viewerId;
            const preview =
              c.lastBody === null
                ? "—"
                : isMine
                  ? `You: ${c.lastBody}`
                  : c.lastBody;
            return (
              <Link
                key={c.conversationId}
                href={`/messages/${c.otherPlayerId}`}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 border-t border-[color:var(--hairline)] first:border-t-0 hover:bg-[color:var(--surface-2)] transition-colors"
              >
                <PlayerAvatar
                  url={c.otherAvatarUrl}
                  initials={initials(c.otherFirstName, c.otherLastName)}
                  size={40}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`truncate text-[14px] ${
                        c.unreadCount > 0
                          ? "font-bold text-[color:var(--text)]"
                          : "font-semibold text-[color:var(--text)]"
                      }`}
                    >
                      {c.otherFirstName} {c.otherLastName}
                    </span>
                    {c.unreadCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-extrabold tracking-[0.04em] bg-[color:var(--brand)] text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                  <div
                    className={`truncate text-[12.5px] ${
                      c.unreadCount > 0
                        ? "text-[color:var(--text-2)] font-medium"
                        : "text-[color:var(--text-3)]"
                    }`}
                  >
                    {preview}
                  </div>
                </div>
                <div className="text-[10.5px] text-[color:var(--text-4)] font-[family-name:var(--mono)] num">
                  {fmtRelative(c.lastMessageAt)}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Confirm "clear recent" — quick inline modal-ish overlay. */}
      {confirmClear && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
          onClick={() => setConfirmClear(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-[16px] bg-[color:var(--surface)] border border-[color:var(--hairline-2)] shadow-xl p-5 flex flex-col gap-3"
          >
            <div className="font-bold text-[15px]">Clear recent messages?</div>
            <p className="text-[13px] text-[color:var(--text-3)] leading-relaxed">
              This hides every conversation from your list. The other people
              still see the threads — and any new messages they send will
              bring the conversation back.
            </p>
            <div className="flex justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="h-9 px-4 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] text-[12px] font-semibold tracking-[0.04em] uppercase text-[color:var(--text-2)] hover:text-[color:var(--text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onClearAll}
                disabled={pending}
                className="h-9 px-4 rounded-[var(--r-md)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white text-[12px] font-bold tracking-[0.05em] uppercase disabled:opacity-60"
              >
                {pending ? "Clearing…" : "Clear all"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New-message picker. */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-[16px] bg-[color:var(--surface)] border border-[color:var(--hairline-2)] shadow-xl flex flex-col max-h-[80vh]"
          >
            <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
              <div className="font-bold text-[15px]">New message</div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setPickerOpen(false)}
                className="text-[color:var(--text-3)] hover:text-[color:var(--text)]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-4 pb-2">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--text-4)]"
                />
                <input
                  autoFocus
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="Search players…"
                  className="w-full h-10 pl-8 pr-3 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] text-[14px] outline-none focus:border-[color:var(--brand)]"
                />
              </div>
            </div>
            <div className="overflow-y-auto px-2 pb-3">
              {filteredPicker.length === 0 ? (
                <div className="text-center text-[12.5px] text-[color:var(--text-3)] py-8">
                  {messageable.length === 0
                    ? "You aren't in any leagues yet — join one to message other players."
                    : pickerQuery
                      ? "No matches."
                      : "Everyone you can message already has an open thread."}
                </div>
              ) : (
                filteredPicker.map((p) => (
                  <Link
                    key={p.id}
                    href={`/messages/${p.id}`}
                    onClick={() => setPickerOpen(false)}
                    className="grid grid-cols-[auto_1fr] items-center gap-3 px-2 py-2 rounded-[var(--r-md)] hover:bg-[color:var(--surface-2)]"
                  >
                    <PlayerAvatar
                      url={p.avatarUrl}
                      initials={initials(p.firstName, p.lastName)}
                      size={32}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold">
                        {p.firstName} {p.lastName}
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
