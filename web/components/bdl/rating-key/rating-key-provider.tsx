"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { GradeKey, RatingContext } from "./copy";
import { RatingKeyModal } from "./rating-key-modal";

type OpenArgs = {
  context: RatingContext;
  grade: GradeKey;
  trigger: HTMLElement | null;
};

type RatingKeyContextValue = {
  open: (args: OpenArgs) => void;
};

const RatingKeyCtx = createContext<RatingKeyContextValue | null>(null);

export function useRatingKey() {
  const ctx = useContext(RatingKeyCtx);
  if (!ctx) {
    throw new Error("useRatingKey must be used inside <RatingKeyProvider>");
  }
  return ctx;
}

/**
 * Single global host for the rating-key modal. Any GradePill rendered
 * inside the tree can open it via useRatingKey().open(...). Mounting
 * once avoids per-pill dialog instances and keeps focus management
 * clean.
 */
export function RatingKeyProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [args, setArgs] = useState<{
    context: RatingContext;
    grade: GradeKey;
  }>({ context: "player", grade: "Not Rated" });
  const triggerRef = useRef<HTMLElement | null>(null);

  const handleOpen = useCallback(({ context, grade, trigger }: OpenArgs) => {
    triggerRef.current = trigger;
    setArgs({ context, grade });
    setOpen(true);
  }, []);

  const value = useMemo<RatingKeyContextValue>(
    () => ({ open: handleOpen }),
    [handleOpen],
  );

  return (
    <RatingKeyCtx.Provider value={value}>
      {children}
      <RatingKeyModal
        open={open}
        onClose={() => setOpen(false)}
        initialContext={args.context}
        highlightGrade={args.grade}
        triggerEl={triggerRef.current}
      />
    </RatingKeyCtx.Provider>
  );
}
