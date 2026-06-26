"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { setDefaultHomeAction } from "@/lib/cookies/default-home";

export function ApplyPersona({ persona }: { persona: string }) {
  const router = useRouter();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      await setDefaultHomeAction(persona);
      router.replace("/home");
      router.refresh();
    })();
  }, [persona, router]);

  return (
    <p className="text-[13px] text-[color:var(--text-3)] text-center">Setting up…</p>
  );
}
