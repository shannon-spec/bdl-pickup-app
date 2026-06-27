import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { getRememberedLogin } from "@/lib/cookies/last-login";
import { Brand } from "@/components/bdl/brand";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · BDL" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const session = await readSession();
  if (session) redirect(sp.next?.startsWith("/") ? sp.next : "/home");
  const remembered = await getRememberedLogin();

  const intent =
    sp.intent === "organize"
      ? "organize"
      : sp.intent === "coach"
        ? "coach"
        : sp.intent === "play"
          ? "play"
          : null;
  const heading =
    intent === "organize"
      ? "Run your league or tournament"
      : intent === "coach"
        ? "Coach your team"
        : intent === "play"
          ? "Find your run"
          : "Sign in";
  const sub =
    intent === "organize"
      ? "Sign in to create and manage."
      : intent === "coach"
        ? "Sign in to manage your roster."
        : intent === "play"
          ? "Sign in to RSVP and track your runs."
          : "Ball Don't Lie Pickup";

  return (
    <main
      className="min-h-[100dvh] flex items-center justify-center px-4 py-8"
      style={{
        backgroundColor: "#0A0E14",
        backgroundImage:
          "linear-gradient(180deg, rgba(6,9,13,.90) 0%, rgba(6,9,13,.80) 50%, rgba(6,9,13,.93) 100%), url(/hero-court.jpg)",
        backgroundSize: "cover, cover",
        backgroundPosition: "center, center",
      }}
    >
      <div className="w-full max-w-[400px] rounded-[16px] border border-[color:var(--hairline-2)] bg-[color:var(--surface)] p-6 sm:p-8">
        <div className="flex flex-col items-center gap-4 mb-6">
          <Brand height={56} />
          <div className="text-center">
            <h1 className="text-[18px] font-bold tracking-[-0.02em]">{heading}</h1>
            <p className="text-[13px] text-[color:var(--text-3)] mt-1">{sub}</p>
          </div>
        </div>
        <LoginForm intent={intent} next={sp.next ?? null} remembered={remembered} />
      </div>
    </main>
  );
}
