"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const COOKIE = "bdl_default_home";
const VALID = new Set(["play", "coach", "organize", "watch"]);

export type HomeKind = "play" | "coach" | "organize" | "watch";

export async function getDefaultHome(): Promise<HomeKind> {
  const store = await cookies();
  const v = store.get(COOKIE)?.value;
  return v && VALID.has(v) ? (v as HomeKind) : "play";
}

/** Persona fork choice — sets the landing home. Locks nothing; the context
 *  switcher still reaches every role. */
export async function setDefaultHomeAction(kind: string): Promise<void> {
  if (!VALID.has(kind)) return;
  const store = await cookies();
  store.set({
    name: COOKIE,
    value: kind,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
