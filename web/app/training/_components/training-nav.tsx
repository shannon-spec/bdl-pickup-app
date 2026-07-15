import Link from "next/link";

const TABS = [
  { key: "train", label: "Train", href: "/training" },
  { key: "cart", label: "Cart", href: "/training/cart" },
  { key: "log", label: "Log", href: "/training/log" },
  { key: "stats", label: "Stats", href: "/training/stats" },
] as const;

export type TrainingTab = (typeof TABS)[number]["key"];

/** Pill link-bar across the four Training screens (mirrors the /stats FilterBar). */
export function TrainingNav({ active }: { active: TrainingTab }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`inline-flex items-center h-8 px-3.5 rounded-full text-[12px] font-semibold tracking-[0.04em] uppercase transition-colors ${
              on
                ? "bg-[color:var(--brand)] text-white shadow-[var(--cta-shadow)]"
                : "bg-[color:var(--surface)] text-[color:var(--text-2)] shadow-[inset_0_0_0_1px_var(--hairline-2)] hover:text-[color:var(--text)]"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
