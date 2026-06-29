import Image from "next/image";

const LOCKUP_RATIO = 947 / 321; // aspect ratio of bdl-lockup-*.png (BDL x rivals)

/** Dark "phase" top bar used across the onboarding screens. */
export function OnboardingHeader({
  phase,
  avatarUrl,
  initials,
}: {
  phase: string;
  avatarUrl?: string | null;
  initials?: string | null;
}) {
  const h = 28;
  return (
    <header
      className="flex items-center justify-between gap-3 rounded-[18px] px-5 py-3.5 text-white"
      style={{ backgroundColor: "#0A0E14" }}
    >
      <Image
        src="/bdl-lockup-dark.png"
        alt="BDL · Ball Don't Lie"
        width={Math.round(h * LOCKUP_RATIO)}
        height={h}
        priority
        style={{ height: h, width: "auto" }}
      />
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-medium text-white/65">{phase}</span>
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 overflow-hidden text-[12px] font-bold text-white/80">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initials || ""
          )}
        </span>
      </div>
    </header>
  );
}
