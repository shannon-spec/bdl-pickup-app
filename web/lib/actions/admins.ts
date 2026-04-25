"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, superAdmins } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const adminSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Username must be at least 2 chars.")
    .max(40)
    .regex(/^[a-z0-9._-]+$/i, "Letters, digits, dot, dash, underscore only."),
  firstName: z.string().trim().min(1, "First name is required.").max(60),
  lastName: z.string().trim().min(1, "Last name is required.").max(60),
  email: z.string().trim().email("Invalid email."),
  playerId: z.string().uuid().optional().or(z.literal("")),
});

const readForm = (fd: FormData) => {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  return o;
};
const orNull = (v?: string | null) => (v && v !== "" ? v : null);

export async function createSuperAdmin(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = adminSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const v = parsed.data;
  const username = v.username.toLowerCase();

  const [existing] = await db
    .select()
    .from(superAdmins)
    .where(eq(superAdmins.username, username))
    .limit(1);
  if (existing) return { ok: false, error: "Username already exists." };

  const [row] = await db
    .insert(superAdmins)
    .values({
      username,
      firstName: v.firstName,
      lastName: v.lastName,
      email: v.email,
      role: "super_admin",
      playerId: orNull(v.playerId),
    })
    .returning({ id: superAdmins.id });
  revalidatePath("/settings");
  return { ok: true, data: { id: row.id } };
}

export async function setLinkedPlayer(
  adminId: string,
  playerId: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  await db.update(superAdmins).set({ playerId }).where(eq(superAdmins.id, adminId));
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteSuperAdmin(adminId: string): Promise<ActionResult> {
  await requireAdmin();
  // Owners are protected
  const [admin] = await db
    .select()
    .from(superAdmins)
    .where(eq(superAdmins.id, adminId))
    .limit(1);
  if (!admin) return { ok: false, error: "Admin not found." };
  if (admin.role === "owner") return { ok: false, error: "Owners cannot be removed." };
  await db.delete(superAdmins).where(eq(superAdmins.id, adminId));
  revalidatePath("/settings");
  return { ok: true };
}
