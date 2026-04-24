import { cn } from "~/lib/utils";

export type PosterSize = "sm" | "md" | "lg" | "xl";

export type PosterMovie = {
  id: string;
  title?: string | null;
  year?: number | string | null;
  posterUrl?: string | null;
};

type PosterProps = {
  movie: PosterMovie;
  size?: PosterSize;
  tilt?: number;
  badge?: string;
  className?: string;
  onClick?: () => void;
};

const SIZE_WIDTH: Record<PosterSize, number> = {
  sm: 80,
  md: 140,
  lg: 220,
  xl: 280,
};

const TITLE_SIZE: Record<PosterSize, string> = {
  sm: "text-[11px]",
  md: "text-sm",
  lg: "text-lg",
  xl: "text-[22px]",
};

const HUES = ["#3a2e24", "#2d3a2a", "#2a2d3a", "#3a2a38", "#3a352a"];

function hashHue(id: string) {
  const sum = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return HUES[sum % HUES.length];
}

export function Poster({
  movie,
  size = "md",
  tilt = 0,
  badge,
  className,
  onClick,
}: PosterProps) {
  const width = SIZE_WIDTH[size];
  const hue = hashHue(movie.id);
  const interactive = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative flex aspect-2/3 flex-none flex-col justify-between rounded-[4px] border-2 border-ink-line p-[10px] transition-transform duration-150 ease-out",
        interactive && "cursor-pointer hover:-translate-y-[3px]",
        className,
      )}
      style={{
        width,
        background: movie.posterUrl
          ? `url(${movie.posterUrl}) center/cover`
          : `linear-gradient(160deg, ${hue} 0%, #120f0b 100%)`,
        transform: tilt ? `rotate(${tilt}deg)` : undefined,
        boxShadow: tilt ? "3px 3px 0 rgba(0,0,0,0.4)" : undefined,
      }}
    >
      {!movie.posterUrl && (
        <>
          <div className="font-mono text-[8px] uppercase tracking-[0.1em] text-muted">
            MV · {movie.year ?? "—"}
          </div>
          <div className={cn("font-hand-2 leading-[1.05] text-ink", TITLE_SIZE[size])}>
            {movie.title ?? "—"}
          </div>
        </>
      )}
      {badge && (
        <div className="absolute -right-[6px] -top-[6px] rotate-6 border-[1.5px] border-accent-ink bg-[#d4a017] px-[6px] py-[2px] font-mono text-[9px] uppercase tracking-widest text-accent-ink">
          {badge}
        </div>
      )}
    </div>
  );
}
