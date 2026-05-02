"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eraser,
  Send,
  Search,
  X,
  MessageSquare,
  User,
  Users,
  Globe,
  Mail,
  Smartphone,
} from "lucide-react";
import { PlayerAvatar } from "@/components/bdl/player-avatar";
import {
  clearAllConversations,
  sendMessage,
} from "@/lib/actions/messages";
import { createAnnouncement } from "@/lib/actions/announcements";
import type {
  ConversationListItem,
  MessageablePlayer,
} from "@/lib/queries/messages";
import type { AuthoredAnnouncement } from "@/lib/queries/announcements";

type Audience = "single" | "league" | "global";

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

export function MessageCenterClient({
  conversations,
  messageable,
  viewerId,
  isAdmin,
  isCommissioner,
  leagueOptions,
  emailConfigured,
  broadcastHistory,
}: {
  conversations: ConversationListItem[];
  messageable: MessageablePlayer[];
  viewerId: string;
  isAdmin: boolean;
  isCommissioner: boolean;
  leagueOptions: { id: string; name: string }[];
  emailConfigured: boolean;
  broadcastHistory: AuthoredAnnouncement[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const canBroadcastLeague = isAdmin || isCommissioner;
  const canBroadcastGlobal = isAdmin;

  const [audience, setAudience] = useState<Audience>("single");
  const [recipient, setRecipient] = useState<MessageablePlayer | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [leagueId, setLeagueId] = useState<string>(leagueOptions[0]?.id ?? "");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [emailOn, setEmailOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const resetForm = () => {
    setBody("");
    setHeadline("");
    setCtaLabel("");
    setCtaUrl("");
    setRecipient(null);
    setPickerQuery("");
    setEmailOn(false);
  };

  const submit = () => {
    setError(null);
    setSuccess(null);

    if (audience === "single") {
      if (!recipient || !body.trim()) return;
      const recipientName = `${recipient.firstName} ${recipient.lastName}`;
      const recipientId = recipient.id;
      const trimmed = body.trim();
      start(async () => {
        const res = await sendMessage({
          toPlayerId: recipientId,
          body: trimmed,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setSuccess(`Direct message sent to ${recipientName}.`);
        resetForm();
        router.refresh();
      });
      return;
    }

    // Broadcast (league / global) → use the announcements action.
    if (audience === "league" && !leagueId) {
      setError("Pick a league.");
      return;
    }
    if (!headline.trim() || !body.trim()) {
      setError("Headline and message are required for announcements.");
      return;
    }

    const fd = new FormData();
    fd.set("scope", audience === "global" ? "global" : "league");
    if (audience === "league") fd.set("leagueId", leagueId);
    fd.set("headline", headline);
    fd.set("body", body);
    fd.set("ctaLabel", ctaLabel);
    fd.set("ctaUrl", ctaUrl);
    const channels = ["inbox"];
    if (emailOn && emailConfigured) channels.push("email");
    fd.set("channels", channels.join(","));

    start(async () => {
      const res = await createAnnouncement(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const base = `Announcement sent to ${res.data.recipientCount} player${res.data.recipientCount === 1 ? "" : "s"}'s inbox.`;
      const emailLine =
        res.data.emailSent !== null
          ? ` Emailed ${res.data.emailSent}/${res.data.emailAttempted}.`
          : "";
      setSuccess(base + emailLine);
      resetForm();
      router.refresh();
    });
  };

  const onClearAll = () => {
    setConfirmClear(false);
    start(async () => {
      await clearAllConversations();
      router.refresh();
    });
  };

  // Recipient picker results — sectioned: My Leagues first, then BDL Universe.
  const { mine, universe } = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    const filter = (p: MessageablePlayer): boolean => {
      if (!q) return true;
      return (
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
      );
    };
    const mineList = messageable.filter((p) => p.inMyLeague && filter(p));
    const universeList = messageable.filter((p) => !p.inMyLeague && filter(p));
    return {
      mine: mineList.slice(0, 80),
      universe: universeList.slice(0, q ? 80 : 25),
    };
  }, [pickerQuery, messageable]);

  const isBroadcast = audience !== "single";
  const sendLabel =
    audience === "single"
      ? pending
        ? "Sending…"
        : "Send direct message"
      : audience === "global"
        ? pending
          ? "Sending…"
          : "Send global announcement"
        : pending
          ? "Sending…"
          : "Send to league";

  const submitDisabled =
    pending ||
    !body.trim() ||
    (audience === "single" && !recipient) ||
    (isBroadcast && !headline.trim()) ||
    (audience === "league" && !leagueId);

  return (
    <>
      {/* Compose card */}
      <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-5 flex flex-col gap-3.5">
        <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-3)]">
          Compose
        </div>

        {/* Audience picker — only show toggles when there's more than one option */}
        {(canBroadcastLeague || canBroadcastGlobal) && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
              Audience
            </span>
            <div
              className={`grid gap-2 max-sm:grid-cols-1 ${canBroadcastGlobal ? "grid-cols-3" : "grid-cols-2"}`}
            >
              <AudienceButton
                active={audience === "single"}
                onClick={() => setAudience("single")}
                icon={<User size={13} />}
                label="Single Player"
              />
              {canBroadcastLeague && (
                <AudienceButton
                  active={audience === "league"}
                  onClick={() => setAudience("league")}
                  icon={<Users size={13} />}
                  label="League Members"
                />
              )}
              {canBroadcastGlobal && (
                <AudienceButton
                  active={audience === "global"}
                  onClick={() => setAudience("global")}
                  icon={<Globe size={13} />}
                  label="Global · Every Player"
                />
              )}
            </div>
          </div>
        )}

        {/* Recipient (single) */}
        {audience === "single" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
              Recipient
            </span>
            {recipient ? (
              <div className="flex items-center justify-between gap-3 h-12 px-3 rounded-[var(--r-md)] border border-[color:var(--brand)] bg-[color:var(--brand-soft)]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <PlayerAvatar
                    url={recipient.avatarUrl}
                    initials={initials(recipient.firstName, recipient.lastName)}
                    size={32}
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-[14px] truncate text-[color:var(--text)]">
                      {recipient.firstName} {recipient.lastName}
                    </div>
                    <div className="text-[10.5px] tracking-[0.06em] uppercase font-semibold text-[color:var(--brand-ink,var(--brand))]">
                      {recipient.inMyLeague ? "Your Leagues" : "BDL Universe"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Change recipient"
                  onClick={() => {
                    setRecipient(null);
                    setPickerQuery("");
                    setPickerOpen(true);
                  }}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[color:var(--text-3)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface)] transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--text-4)] pointer-events-none"
                  />
                  <input
                    value={pickerQuery}
                    onChange={(e) => {
                      setPickerQuery(e.target.value);
                      setPickerOpen(true);
                    }}
                    onFocus={() => setPickerOpen(true)}
                    placeholder="Search your leagues or BDL Universe…"
                    className="w-full h-12 pl-8 pr-3 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] text-[14px] outline-none focus:border-[color:var(--brand)]"
                  />
                </div>
                {pickerOpen && (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-[340px] overflow-y-auto rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] shadow-lg">
                    {mine.length === 0 && universe.length === 0 ? (
                      <div className="px-3 py-6 text-center text-[12.5px] text-[color:var(--text-3)]">
                        No matches.
                      </div>
                    ) : (
                      <>
                        {mine.length > 0 && (
                          <SectionLabel>Your Leagues</SectionLabel>
                        )}
                        {mine.map((p) => (
                          <PickerRow
                            key={`mine-${p.id}`}
                            player={p}
                            onSelect={() => {
                              setRecipient(p);
                              setPickerOpen(false);
                            }}
                          />
                        ))}
                        {universe.length > 0 && (
                          <SectionLabel>BDL Universe</SectionLabel>
                        )}
                        {universe.map((p) => (
                          <PickerRow
                            key={`uni-${p.id}`}
                            player={p}
                            onSelect={() => {
                              setRecipient(p);
                              setPickerOpen(false);
                            }}
                          />
                        ))}
                        {!pickerQuery && universe.length === 25 && (
                          <div className="px-3 py-2 text-[11px] text-[color:var(--text-4)] text-center border-t border-[color:var(--hairline)]">
                            Showing 25 — type to search the full universe.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* League picker (league audience) */}
        {audience === "league" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
              League
            </span>
            <select
              value={leagueId}
              onChange={(e) => setLeagueId(e.target.value)}
              className="h-10 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] outline-none"
            >
              {leagueOptions.length === 0 && (
                <option value="">No leagues available</option>
              )}
              {leagueOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Headline (broadcasts only) */}
        {isBroadcast && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
              Headline
            </span>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={160}
              placeholder="Short, scannable — what's this about?"
              className="h-10 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] outline-none focus:border-[color:var(--brand)]"
            />
          </div>
        )}

        {/* Message body — always */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
            Message
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
            rows={4}
            placeholder={
              audience === "single"
                ? recipient
                  ? `Write a direct message to ${recipient.firstName}…`
                  : "Pick a recipient first…"
                : "Write your announcement…"
            }
            className="rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 py-2 text-[14px] outline-none focus:border-[color:var(--brand)] resize-y"
          />
        </div>

        {/* CTA (broadcasts only) */}
        {isBroadcast && (
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
                CTA Label{" "}
                <span className="text-[color:var(--text-4)] font-normal normal-case tracking-normal">
                  (optional)
                </span>
              </span>
              <input
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                maxLength={40}
                placeholder="View League"
                className="h-10 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] outline-none focus:border-[color:var(--brand)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
                CTA URL{" "}
                <span className="text-[color:var(--text-4)] font-normal normal-case tracking-normal">
                  (optional)
                </span>
              </span>
              <input
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                maxLength={500}
                placeholder="/leagues/abc123 or https://…"
                className="h-10 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] outline-none focus:border-[color:var(--brand)]"
              />
            </div>
          </div>
        )}

        {/* Channels — broadcasts only (1:1 is in-app only by design) */}
        {isBroadcast && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
              Channels
            </span>
            <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
              <div className="h-10 rounded-[var(--r-md)] border border-[color:var(--brand)] bg-[color:var(--brand-soft)] text-[color:var(--brand-ink,var(--brand))] inline-flex items-center justify-center gap-1.5 text-[12px] font-bold tracking-[0.04em] uppercase">
                <MessageSquare size={13} /> In-App · Always
              </div>
              <button
                type="button"
                onClick={() => emailConfigured && setEmailOn((v) => !v)}
                disabled={!emailConfigured}
                title={
                  emailConfigured
                    ? undefined
                    : "Email isn't configured — set RESEND_API_KEY + ADMIN_FROM_EMAIL"
                }
                className={`h-10 rounded-[var(--r-md)] border text-[12px] font-bold tracking-[0.04em] uppercase inline-flex items-center justify-center gap-1.5 transition-colors ${
                  !emailConfigured
                    ? "border-[color:var(--hairline-2)] text-[color:var(--text-4)] opacity-50 cursor-not-allowed"
                    : emailOn
                      ? "bg-[color:var(--brand-soft)] border-[color:var(--brand)] text-[color:var(--brand-ink,var(--brand))]"
                      : "border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[color:var(--text-2)] hover:text-[color:var(--text)]"
                }`}
              >
                <Mail size={13} /> Email
                {!emailConfigured && (
                  <span className="text-[9px] font-semibold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-full bg-[color:var(--surface-2)] text-[color:var(--text-3)] ml-1">
                    Off
                  </span>
                )}
              </button>
              <div
                title="Text messaging coming soon"
                className="h-10 rounded-[var(--r-md)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[color:var(--text-4)] opacity-60 cursor-not-allowed inline-flex items-center justify-center gap-1.5 text-[12px] font-bold tracking-[0.04em] uppercase"
              >
                <Smartphone size={13} /> Text
                <span className="text-[9px] font-semibold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-full bg-[color:var(--surface-2)] text-[color:var(--text-3)] ml-1">
                  Soon
                </span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
            {error}
          </div>
        )}
        {success && (
          <div className="text-[12px] text-[color:var(--up)] bg-[color:var(--up-soft)] rounded-[var(--r-md)] px-3 py-2">
            {success}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={submitDisabled}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Send size={13} /> {sendLabel}
          </button>
        </div>
      </div>

      {/* Conversations list */}
      <div className="flex items-center justify-between gap-3 mt-2">
        <div className="inline-flex items-center gap-2.5">
          <span
            aria-hidden
            className="w-[3px] h-[12px] rounded-sm bg-[color:var(--brand)]"
          />
          <span className="text-[11.5px] font-bold tracking-[0.14em] uppercase text-[color:var(--text-2)]">
            Conversations
          </span>
          <span className="text-[12px] font-medium text-[color:var(--text-4)] num">
            {conversations.length}
          </span>
        </div>
        {conversations.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold tracking-[0.04em] uppercase border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[color:var(--text-3)] hover:text-[color:var(--text)] disabled:opacity-60"
          >
            <Eraser size={11} /> Clear recent
          </button>
        )}
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-10 text-center text-[color:var(--text-3)] text-[13.5px]">
          No conversations yet — send a direct message above.
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

      {/* Recent broadcasts (admin / commissioner only) */}
      {(isAdmin || isCommissioner) && broadcastHistory.length > 0 && (
        <>
          <div className="flex items-center gap-2.5 mt-2">
            <span
              aria-hidden
              className="w-[3px] h-[12px] rounded-sm bg-[color:var(--brand)]"
            />
            <span className="text-[11.5px] font-bold tracking-[0.14em] uppercase text-[color:var(--text-2)]">
              Recent Broadcasts
            </span>
            <span className="text-[12px] font-medium text-[color:var(--text-4)] num">
              {broadcastHistory.length}
            </span>
          </div>
          <div className="rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] overflow-hidden">
            {broadcastHistory.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-[1fr_auto] items-start gap-3 px-5 py-3 border-t border-[color:var(--hairline)] first:border-t-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span
                      className={`inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold tracking-[0.05em] uppercase ${
                        a.scope === "global"
                          ? "bg-[color:var(--brand-soft)] text-[color:var(--brand-ink,var(--brand))]"
                          : "bg-[color:var(--surface-2)] text-[color:var(--text-2)] border border-[color:var(--hairline)]"
                      }`}
                    >
                      {a.scope === "global" ? "Global" : a.leagueName ?? "League"}
                    </span>
                    {a.channels.includes("email") && (
                      <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold tracking-[0.05em] uppercase bg-[color:var(--surface-2)] text-[color:var(--text-2)] border border-[color:var(--hairline)]">
                        Email
                      </span>
                    )}
                    <span className="font-bold text-[14px] truncate">
                      {a.headline}
                    </span>
                  </div>
                  <div className="text-[12px] text-[color:var(--text-3)] line-clamp-2">
                    {a.body}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5 text-right">
                  <span className="text-[11px] font-[family-name:var(--mono)] num text-[color:var(--text-3)]">
                    {a.readCount}/{a.recipientCount} read
                  </span>
                  <span className="text-[10.5px] text-[color:var(--text-4)]">
                    {fmtRelative(a.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Clear-all confirm overlay */}
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
    </>
  );
}

function AudienceButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-[var(--r-md)] border text-[12px] font-bold tracking-[0.04em] uppercase transition-colors inline-flex items-center justify-center gap-1.5 ${
        active
          ? "bg-[color:var(--brand-soft)] border-[color:var(--brand)] text-[color:var(--brand-ink,var(--brand))]"
          : "border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[color:var(--text-2)] hover:text-[color:var(--text)]"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-2.5 pb-1 text-[10px] font-bold tracking-[0.14em] uppercase text-[color:var(--text-4)] sticky top-0 bg-[color:var(--surface)] border-b border-[color:var(--hairline)]">
      {children}
    </div>
  );
}

function PickerRow({
  player,
  onSelect,
}: {
  player: MessageablePlayer;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2 hover:bg-[color:var(--surface-2)] text-left"
    >
      <PlayerAvatar
        url={player.avatarUrl}
        initials={initials(player.firstName, player.lastName)}
        size={28}
      />
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-semibold">
          {player.firstName} {player.lastName}
        </div>
      </div>
      <MessageSquare size={13} className="text-[color:var(--text-4)]" />
    </button>
  );
}
