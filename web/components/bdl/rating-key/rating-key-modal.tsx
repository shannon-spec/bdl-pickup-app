"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  DOT_COLORS,
  GRADES,
  PRO_GLOW,
  gradesFor,
  type GradeKey,
  type RatingContext,
} from "./copy";
import { ratingKeyStyles } from "./styles";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export type RatingKeyModalProps = {
  open: boolean;
  onClose: () => void;
  initialContext: RatingContext;
  highlightGrade: GradeKey;
  /** Element to return focus to on close (the trigger pill). */
  triggerEl: HTMLElement | null;
};

export function RatingKeyModal({
  open,
  onClose,
  initialContext,
  highlightGrade,
  triggerEl,
}: RatingKeyModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [context, setContext] = useState<RatingContext>(initialContext);

  // Re-seed tab to the trigger's context on each open.
  useEffect(() => {
    if (open) setContext(initialContext);
  }, [open, initialContext]);

  // Esc + Tab focus trap.
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = dialog.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Move focus into the dialog on open; restore to trigger on close.
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const t = requestAnimationFrame(() => {
      const target = dialog.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    });
    return () => {
      cancelAnimationFrame(t);
      if (triggerEl && document.contains(triggerEl)) triggerEl.focus();
    };
  }, [open, triggerEl]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const grades = gradesFor(context);
  const subtitle =
    context === "player"
      ? "Pickup Skill Tiers // Players"
      : "Pickup Skill Tiers // Leagues";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ratingKeyStyles }} />
      <div
        className="rk-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="rk-dialog"
        >
          <header className="rk-header">
            <div className="rk-titles">
              <div className="rk-subtitle">{subtitle}</div>
              <h2 id={titleId} className="rk-title">
                Rating Key
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="rk-close"
            >
              <X size={18} strokeWidth={2.25} />
            </button>
          </header>

          <div className="rk-tabs" role="tablist">
            <TabBtn
              label="Players"
              active={context === "player"}
              onClick={() => setContext("player")}
            />
            <TabBtn
              label="Leagues"
              active={context === "league"}
              onClick={() => setContext("league")}
            />
          </div>

          <ul className="rk-rows" role="list">
            {GRADES.map((g) => {
              const def = grades[g];
              const active = g === highlightGrade;
              const isPro = g === "Pro";
              return (
                <li
                  key={g}
                  className={`rk-row ${active ? "rk-row-active" : ""}`}
                  aria-current={active ? "true" : undefined}
                >
                  <div className="rk-label">
                    <span
                      className="rk-dot"
                      aria-hidden
                      style={{
                        background: DOT_COLORS[g],
                        boxShadow: isPro ? PRO_GLOW : undefined,
                      }}
                    />
                    <span className="rk-grade-name">{def.key}</span>
                  </div>
                  <p
                    className="rk-desc"
                    dangerouslySetInnerHTML={{ __html: def.bodyHtml }}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}

function TabBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rk-tab ${active ? "rk-tab-active" : ""}`}
    >
      {label}
    </button>
  );
}
