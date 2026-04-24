import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

type ChipProps = {
  children: ReactNode;
  active?: boolean;
  className?: string;
  onClick?: () => void;
};

export function Chip({ children, active, className, onClick }: ChipProps) {
  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-[6px] rounded-chip border-[1.5px] border-ink-line px-3 pb-[3px] pt-1 font-hand text-sm shadow-ink-sm",
        active ? "bg-accent text-accent-ink" : "bg-pill text-ink",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </span>
  );
}
