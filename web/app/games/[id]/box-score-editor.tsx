"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Check, ImageUp, Loader2, Trash2 } from "lucide-react";
import { saveGameStats, clearGameStats } from "@/lib/actions/games";
import type { StatRowInput } from "@/lib/stats";

const COLUMNS = [
  { key: "minutes", label: "MIN" },
  { key: "points", label: "PTS" },
  { key: "rebounds", label: "REB" },
  { key: "oreb", label: "OREB" },
  { key: "dreb", label: "DREB" },
  { key: "assists", label: "AST" },
  { key: "steals", label: "STL" },
  { key: "blocks", label: "BLK" },
  { key: "turnovers", label: "TO" },
  { key: "fouls", label: "PF" },
  { key: "fgm", label: "FGM" },
  { key: "fga", label: "FGA" },
  { key: "tpm", label: "3PM" },
  { key: "tpa", label: "3PA" },
  { key: "ftm", label: "FTM" },
  { key: "fta", label: "FTA" },
] as const;

type StatKey = (typeof COLUMNS)[number]["key"];

export type StatPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  side: "A" | "B";
};

type Row = Record<StatKey, string>;

const emptyRow = (): Row =>
  Object.fromEntries(COLUMNS.map((c) => [c.key, ""])) as Row;

export function BoxScoreEditor({
  gameId,
  teamAName,
  teamBName,
  players,
  initial,
}: {
  gameId: string;
  teamAName: string;
  teamBName: string;
  players: StatPlayer[];
  initial: Record<string, Partial<Record<StatKey, number | null>>>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, Row>>(() => {
    const o: Record<string, Row> = {};
    for (const p of players) {
      const r = emptyRow();
      const src = initial[p.id];
      if (src) {
        for (const c of COLUMNS) {
          const v = src[c.key];
          if (v !== null && v !== undefined) r[c.key] = String(v);
        }
      }
      o[p.id] = r;
    }
    return o;
  });

  const setCell = (pid: string, key: StatKey, value: string) => {
    setSaved(false);
    setRows((prev) => ({
      ...prev,
      [pid]: { ...(prev[pid] ?? emptyRow()), [key]: value },
    }));
  };

  // --- Import from image(s) ---
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const runImport = async (files: File[]) => {
    if (files.length === 0 || importing) return;
    setImporting(true);
    setImportMsg(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("gameId", gameId);
      fd.set(
        "roster",
        JSON.stringify(
          players.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}` })),
        ),
      );
      for (const f of files.slice(0, 8)) fd.append("images", f);
      const res = await fetch("/api/box-score-ocr", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not read the image.");
        return;
      }
      const matched: Record<string, Record<string, number | null>> = data.matched ?? {};
      const ids = Object.keys(matched);
      // A player was really imported only if they're on the roster AND at
      // least one numeric value came back — otherwise nothing fills the grid.
      const onRoster = (id: string) => players.some((p) => p.id === id);
      const hasValues = (id: string) =>
        COLUMNS.some((c) => {
          const v = matched[id][c.key];
          return v !== null && v !== undefined;
        });
      const filled = ids.filter((id) => onRoster(id) && hasValues(id));
      const matchedEmpty = ids.filter((id) => onRoster(id) && !hasValues(id));
      setSaved(false);
      setRows((prev) => {
        const next = { ...prev };
        for (const id of filled) {
          const row = { ...(next[id] ?? emptyRow()) };
          for (const c of COLUMNS) {
            const v = matched[id][c.key];
            if (v !== null && v !== undefined) row[c.key] = String(v);
          }
          next[id] = row;
        }
        return next;
      });
      const unmatched: string[] = data.unmatched ?? [];
      const parts: string[] = [];
      if (filled.length)
        parts.push(`Imported stats for ${filled.length} player${filled.length === 1 ? "" : "s"}.`);
      else parts.push("No stats could be read from the image.");
      if (matchedEmpty.length)
        parts.push(
          `No numbers detected for ${matchedEmpty.length} matched player${matchedEmpty.length === 1 ? "" : "s"}.`,
        );
      if (unmatched.length)
        parts.push(`Couldn't match: ${unmatched.join(", ")}.`);
      if (filled.length) parts.push("Review the numbers, then Save.");
      setImportMsg(parts.join(" "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the image.");
    } finally {
      setImporting(false);
    }
  };

  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const onClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setClearing(true);
    setError(null);
    start(async () => {
      const res = await clearGameStats(gameId);
      setClearing(false);
      setConfirmClear(false);
      if (res.ok) {
        setRows(() => {
          const o: Record<string, Row> = {};
          for (const p of players) o[p.id] = emptyRow();
          return o;
        });
        setSaved(false);
        setImportMsg(null);
        router.refresh();
      } else setError(res.error);
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    runImport(files);
  };

  const onSave = () => {
    setError(null);
    const payload: StatRowInput[] = players.map((p) => ({
      playerId: p.id,
      ...(rows[p.id] ?? emptyRow()),
    }));
    // Guard against silently "saving" a blank grid: without at least one
    // value there's nothing to store, and the box score would stay hidden.
    const hasAny = players.some((p) =>
      COLUMNS.some((c) => (rows[p.id]?.[c.key] ?? "").trim() !== ""),
    );
    if (!hasAny) {
      setSaved(false);
      setError("Nothing to save — enter or import stats first.");
      return;
    }
    start(async () => {
      const res = await saveGameStats(gameId, payload);
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else setError(res.error);
    });
  };

  if (players.length === 0) {
    return (
      <div className="text-[13px] text-[color:var(--text-3)]">
        Add players to the rosters first, then enter their stats here.
      </div>
    );
  }

  const cellInput =
    "w-12 h-8 rounded-[8px] bg-[color:var(--surface-2)] text-center text-[13px] num font-[family-name:var(--mono)] outline-none shadow-[inset_0_0_0_1px_var(--hairline-2)] focus:shadow-[inset_0_0_0_1.5px_var(--brand)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  const sideName = (s: "A" | "B") => (s === "A" ? teamAName : teamBName);

  return (
    <div className="flex flex-col gap-3">
      {/* Import from image(s) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-[12px] px-4 py-5 text-center cursor-pointer transition-colors outline-dashed outline-2 outline-offset-[-2px] ${
          dragOver
            ? "outline-[color:var(--brand)] bg-[color:var(--brand-soft)]"
            : "outline-[color:var(--hairline-2)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-2)]"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            runImport(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        {importing ? (
          <Loader2 size={20} className="animate-spin text-[color:var(--brand)]" />
        ) : (
          <ImageUp size={20} className="text-[color:var(--text-3)]" />
        )}
        <span className="text-[13px] font-semibold text-[color:var(--text-2)]">
          {importing
            ? "Reading box score…"
            : "Drag stat-sheet image(s) here, or click to upload"}
        </span>
        <span className="text-[11px] text-[color:var(--text-4)]">
          Auto-fills the grid below for review · up to 8 images · PNG/JPG
        </span>
      </div>

      {importMsg && (
        <div className="text-[12px] text-[color:var(--brand-ink)] bg-[color:var(--brand-soft)] rounded-[var(--r-md)] px-3 py-2">
          {importMsg}
        </div>
      )}

      <div className="overflow-x-auto rounded-[12px] bg-[color:var(--surface)] shadow-[inset_0_0_0_1px_var(--hairline)]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[10px] font-bold tracking-[0.08em] uppercase text-[color:var(--text-3)]">
              <th className="sticky left-0 z-10 bg-[color:var(--surface)] text-left px-3 py-2 min-w-[150px]">
                Player
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-1.5 py-2 text-center">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const row = rows[p.id] ?? emptyRow();
              return (
                <tr
                  key={p.id}
                  className="shadow-[inset_0_1px_0_0_var(--hairline)]"
                >
                  <td className="sticky left-0 z-10 bg-[color:var(--surface)] px-3 py-1.5 min-w-[150px]">
                    <div className="flex flex-col leading-tight">
                      <span className="font-semibold text-[13.5px] truncate">
                        {p.firstName} {p.lastName}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-4)] truncate">
                        {sideName(p.side)}
                      </span>
                    </div>
                  </td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="px-1 py-1.5 text-center">
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={row[c.key]}
                        onChange={(e) => setCell(p.id, c.key, e.target.value)}
                        className={cellInput}
                        aria-label={`${p.firstName} ${p.lastName} ${c.label}`}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="text-[12px] text-[color:var(--down)] bg-[color:var(--down-soft)] rounded-[var(--r-md)] px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {saved && !pending && (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--up)]">
            <Check size={14} /> Saved
          </span>
        )}
        <button
          type="button"
          onClick={onClear}
          disabled={pending}
          onBlur={() => setConfirmClear(false)}
          className={`inline-flex items-center justify-center gap-1.5 h-10 px-4 mr-auto rounded-[var(--r-lg)] text-[12px] font-bold tracking-[0.06em] uppercase transition-colors disabled:opacity-60 ${
            confirmClear
              ? "bg-[color:var(--down-soft)] text-[color:var(--down)]"
              : "text-[color:var(--text-2)] hover:text-[color:var(--down)] shadow-[inset_0_0_0_1px_var(--hairline-2)]"
          }`}
        >
          <Trash2 size={14} strokeWidth={2.5} />
          {clearing ? "Clearing…" : confirmClear ? "Confirm clear all?" : "Clear stats"}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-[var(--r-lg)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] text-white font-bold text-[12px] tracking-[0.06em] uppercase shadow-[var(--cta-shadow)] disabled:opacity-60"
        >
          <BarChart3 size={14} strokeWidth={2.5} />
          {pending ? "Saving…" : "Save box score"}
        </button>
      </div>
    </div>
  );
}
