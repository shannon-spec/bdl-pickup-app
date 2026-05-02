"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Send } from "lucide-react";
import {
  sendMessage,
  markThreadRead,
  clearConversation,
} from "@/lib/actions/messages";
import type { ThreadMessage } from "@/lib/queries/messages";

const fmtTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const fmtDay = (iso: string): string => {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (isToday) return "Today";
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  if (
    d.getFullYear() === yest.getFullYear() &&
    d.getMonth() === yest.getMonth() &&
    d.getDate() === yest.getDate()
  )
    return "Yesterday";
  return d.toLocaleDateString();
};

type LocalMessage = ThreadMessage & { sending?: boolean };

export function ThreadClient({
  otherPlayerId,
  otherFirstName,
  initialMessages,
  viewerId,
}: {
  otherPlayerId: string;
  otherFirstName: string;
  initialMessages: ThreadMessage[];
  viewerId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [messages, setMessages] = useState<LocalMessage[]>(initialMessages);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mark unread incoming messages as read on mount.
  useEffect(() => {
    const hasUnread = initialMessages.some(
      (m) => !m.mine && !m.readAt,
    );
    if (!hasUnread) return;
    void markThreadRead(otherPlayerId).then(() => router.refresh());
  }, [otherPlayerId, initialMessages, router]);

  // Auto-scroll to the bottom on initial mount + after sends.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    const optimistic: LocalMessage = {
      id: `tmp-${Date.now()}`,
      senderId: viewerId,
      body: trimmed,
      createdAt: new Date().toISOString(),
      readAt: null,
      mine: true,
      sending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setBody("");
    start(async () => {
      const res = await sendMessage({ toPlayerId: otherPlayerId, body: trimmed });
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setError(res.error);
        setBody(trimmed);
        return;
      }
      router.refresh();
    });
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onClearThis = () => {
    setConfirmClear(false);
    start(async () => {
      await clearConversation(otherPlayerId);
      router.push("/messages");
    });
  };

  // Group messages by day for date dividers.
  const grouped: { day: string; items: LocalMessage[] }[] = [];
  for (const m of messages) {
    const day = fmtDay(m.createdAt);
    const last = grouped[grouped.length - 1];
    if (last && last.day === day) last.items.push(m);
    else grouped.push({ day, items: [m] });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold tracking-[0.04em] uppercase border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[color:var(--text-3)] hover:text-[color:var(--text)] disabled:opacity-60"
          >
            <Eraser size={11} /> Clear thread
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-4 min-h-[300px] max-h-[60vh] overflow-y-auto flex flex-col gap-2"
      >
        {messages.length === 0 ? (
          <div className="m-auto text-center text-[13px] text-[color:var(--text-3)] py-8">
            No messages yet. Say hi to {otherFirstName}.
          </div>
        ) : (
          grouped.map((g) => (
            <div key={g.day} className="flex flex-col gap-1.5">
              <div className="text-center text-[10.5px] font-semibold tracking-[0.1em] uppercase text-[color:var(--text-4)] py-1">
                {g.day}
              </div>
              {g.items.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[75%] flex flex-col gap-0.5">
                    <div
                      className={`px-3.5 py-2 rounded-[14px] text-[13.5px] whitespace-pre-wrap break-words ${
                        m.mine
                          ? "bg-[color:var(--brand)] text-white rounded-br-[4px]"
                          : "bg-[color:var(--surface-2)] text-[color:var(--text)] border border-[color:var(--hairline)] rounded-bl-[4px]"
                      } ${m.sending ? "opacity-70" : ""}`}
                    >
                      {m.body}
                    </div>
                    <div
                      className={`text-[10px] text-[color:var(--text-4)] num font-[family-name:var(--mono)] ${
                        m.mine ? "text-right" : "text-left"
                      }`}
                    >
                      {fmtTime(m.createdAt)}
                      {m.mine && m.readAt && " · Read"}
                      {m.sending && " · Sending"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {error && (
        <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKey}
          maxLength={4000}
          rows={2}
          placeholder={`Message ${otherFirstName}…`}
          className="flex-1 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 py-2 text-[14px] outline-none focus:border-[color:var(--brand)] resize-y min-h-[48px]"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !body.trim()}
          className="inline-flex items-center justify-center gap-1.5 h-[48px] px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
        >
          <Send size={13} /> Send
        </button>
      </div>

      {confirmClear && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
          onClick={() => setConfirmClear(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-[16px] bg-[color:var(--surface)] border border-[color:var(--hairline-2)] shadow-xl p-5 flex flex-col gap-3"
          >
            <div className="font-bold text-[15px]">Clear this thread?</div>
            <p className="text-[13px] text-[color:var(--text-3)] leading-relaxed">
              This hides the conversation from your list. {otherFirstName}{" "}
              still sees it — and any new message will bring it back into your
              list.
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
                onClick={onClearThis}
                disabled={pending}
                className="h-9 px-4 rounded-[var(--r-md)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white text-[12px] font-bold tracking-[0.05em] uppercase disabled:opacity-60"
              >
                {pending ? "Clearing…" : "Clear thread"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
