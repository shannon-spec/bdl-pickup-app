import { cn } from "@/lib/utils";
import { LeaguePill } from "./league-pill";

export function ContextStrip({
  leagueName,
  season,
  schedule,
  hasMoreLeagues,
  onSwitchLeague,
  className,
}: {
  leagueName: string;
  season?: string;
  schedule?: React.ReactNode;
  hasMoreLeagues?: boolean;
  onSwitchLeague?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        "max-sm:flex-col max-sm:items-start",
        className,
      )}
    >
      <LeaguePill
        name={leagueName}
        season={season}
        hasMore={hasMoreLeagues}
        onClick={onSwitchLeague}
      />
      {schedule && (
        <div className="text-[13px] text-[color:var(--text-3)]">{schedule}</div>
      )}
    </div>
  );
}
