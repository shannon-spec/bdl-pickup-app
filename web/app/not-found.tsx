import Link from "next/link";
import { Brand } from "@/components/bdl/brand";

export const metadata = { title: "Not found · BDL" };

export default function NotFound() {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[400px] text-center flex flex-col items-center gap-4">
        <Brand height={44} />
        <div>
          <h1 className="text-[22px] font-extrabold tracking-[-0.02em]">
            That link didn&apos;t work
          </h1>
          <p className="text-[14px] text-[color:var(--text-2)] mt-1.5">
            The page you&apos;re after may have moved, ended, or never existed.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <Link
            href="/home"
            className="inline-flex items-center h-11 px-5 rounded-[12px] bg-[color:var(--brand)] text-white font-bold text-[13px] tracking-[0.04em] uppercase hover:bg-[color:var(--brand-hover)]"
          >
            Go home
          </Link>
          <Link
            href="/discover"
            className="inline-flex items-center h-11 px-5 rounded-[12px] bg-[color:var(--surface)] font-bold text-[13px] text-[color:var(--text-2)] hover:bg-[color:var(--surface-2)] shadow-[inset_0_0_0_1px_var(--hairline-2)]"
          >
            Browse leagues & teams
          </Link>
        </div>
      </div>
    </main>
  );
}
