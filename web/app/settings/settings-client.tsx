"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Send, Trash2 } from "lucide-react";
import { createSuperAdmin, deleteSuperAdmin, setLinkedPlayer } from "@/lib/actions/admins";
import { Pill } from "@/components/bdl/pill";

type AdminRowProps = {
  admin: {
    id: string;
    username: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    role: "owner" | "super_admin";
    playerId: string | null;
  };
  allPlayers: { id: string; firstName: string; lastName: string }[];
};

export function SettingsClient(_: { children?: React.ReactNode }) {
  return null;
}

SettingsClient.AdminRow = function AdminRow({ admin, allPlayers }: AdminRowProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sending, setSending] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sendError, setSendError] = useState<string | null>(null);

  const isOwner = admin.role === "owner";

  const onLinkChange = (playerId: string) => {
    start(async () => {
      const res = await setLinkedPlayer(admin.id, playerId || null);
      if (res.ok) router.refresh();
    });
  };

  const onSend = async () => {
    if (!admin.email) return;
    setSending("sending");
    setSendError(null);
    try {
      const res = await fetch("/api/send-admin-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: admin.firstName ?? "Admin",
          lastName: admin.lastName ?? "",
          email: admin.email,
          username: admin.username,
          password: "bdl2026",
          loginUrl: window.location.origin + "/login",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to send.");
      setSending("sent");
      setTimeout(() => setSending("idle"), 3000);
    } catch (err) {
      setSending("error");
      setSendError((err as Error).message);
    }
  };

  const onDelete = () => {
    if (isOwner) return;
    if (!confirm(`Remove "${admin.username}"?`)) return;
    start(async () => {
      const res = await deleteSuperAdmin(admin.id);
      if (res.ok) router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-[1fr_2fr_auto_auto] max-md:grid-cols-1 max-md:gap-2 items-center gap-4 px-5 py-3 border-t border-[color:var(--hairline)] first:border-t-0">
      <div>
        <div className="font-bold text-[14px]">{admin.username}</div>
        <div className="text-[11.5px] text-[color:var(--text-3)] mt-0.5 flex items-center gap-2">
          {admin.firstName} {admin.lastName}
          {isOwner ? <Pill tone="brand">Owner</Pill> : <Pill tone="neutral">Super Admin</Pill>}
        </div>
        {admin.email && (
          <div className="text-[11.5px] text-[color:var(--text-3)] mt-0.5">{admin.email}</div>
        )}
      </div>
      <select
        value={admin.playerId ?? ""}
        disabled={pending}
        onChange={(e) => onLinkChange(e.target.value)}
        aria-label={`Linked player for ${admin.username}`}
        className="h-9 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[13px] outline-none cursor-pointer disabled:opacity-60"
      >
        <option value="">— No linked player —</option>
        {allPlayers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.lastName}, {p.firstName}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!admin.email || sending === "sending"}
        onClick={onSend}
        title={admin.email ? "Send credentials by email" : "No email on file"}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[12px] font-medium hover:bg-[color:var(--surface-2)] disabled:opacity-50"
      >
        <Send size={13} />
        {sending === "sending" ? "Sending…" : sending === "sent" ? "Sent ✓" : "Send creds"}
      </button>
      {isOwner ? (
        <span className="text-[11px] text-[color:var(--text-3)] uppercase tracking-[0.06em] font-semibold">
          Protected
        </span>
      ) : (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Remove ${admin.username}`}
          className="w-9 h-9 inline-flex items-center justify-center rounded-[var(--r-md)] text-[color:var(--text-3)] hover:text-[color:var(--down)] hover:bg-[color:var(--down-soft)]"
        >
          <Trash2 size={14} />
        </button>
      )}
      {sendError && (
        <div className="col-span-full text-[11.5px] text-[color:var(--down)]">{sendError}</div>
      )}
    </div>
  );
};

SettingsClient.AddAdmin = function AddAdmin({
  allPlayers,
}: {
  allPlayers: { id: string; firstName: string; lastName: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();

  const onSubmit = (formData: FormData) => {
    setError(null);
    setFieldErrors({});
    start(async () => {
      const res = await createSuperAdmin(formData);
      if (res.ok) {
        setOpen(false);
        router.refresh();
        return;
      }
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[#DC3D14] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] self-start"
      >
        <Plus size={14} strokeWidth={2.5} /> Add Super Admin
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add super admin"
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center px-4 bg-black/60"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[460px] rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[18px] font-bold mb-4">Add Super Admin</h3>
            <form action={onSubmit} className="flex flex-col gap-3">
              <Row>
                <Field label="First Name *" error={fieldErrors.firstName?.[0]}>
                  <input name="firstName" required autoFocus className={inputCx} />
                </Field>
                <Field label="Last Name *" error={fieldErrors.lastName?.[0]}>
                  <input name="lastName" required className={inputCx} />
                </Field>
              </Row>
              <Field label="Email *" error={fieldErrors.email?.[0]}>
                <input name="email" type="email" required className={inputCx} />
              </Field>
              <Field label="Username *" error={fieldErrors.username?.[0]}>
                <input name="username" required className={inputCx} />
              </Field>
              <Field label="Link to Player (optional)" error={fieldErrors.playerId?.[0]}>
                <select name="playerId" defaultValue="" className={selectCx}>
                  <option value="">— No linked player —</option>
                  {allPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.lastName}, {p.firstName}
                    </option>
                  ))}
                </select>
              </Field>
              {error && (
                <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
                  {error}
                </div>
              )}
              <p className="text-[11.5px] text-[color:var(--text-3)]">
                All Super Admins use the shared password: <strong>bdl2026</strong>
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-10 px-4 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] text-[13px] font-medium hover:bg-[color:var(--surface-2)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60"
                >
                  {pending ? "Adding…" : "Add admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

const inputCx =
  "w-full h-10 rounded-[var(--r-lg)] border border-[color:var(--hairline-2)] bg-[color:var(--surface-2)] px-3 text-[14px] text-[color:var(--text)] outline-none focus:border-[color:var(--brand)] transition-colors placeholder:text-[color:var(--text-4)]";
const selectCx = inputCx + " pr-8 cursor-pointer";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 flex-1 min-w-0">
      <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-3)]">
        {label}
      </span>
      {children}
      {error && <span className="text-[11px] text-[color:var(--down)]">{error}</span>}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">{children}</div>;
}
