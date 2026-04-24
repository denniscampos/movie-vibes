import { cn } from "~/lib/utils";

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  size?: number;
  readOnly?: boolean;
  className?: string;
};

export function StarRating({
  value,
  onChange,
  max = 5,
  size = 30,
  readOnly = false,
  className,
}: StarRatingProps) {
  return (
    <div className={cn("flex gap-2", className)}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(n)}
            aria-label={`Rate ${n} of ${max}`}
            className={cn(
              "font-hand-2 leading-none",
              filled ? "text-accent" : "text-rule",
              readOnly ? "cursor-default" : "cursor-pointer",
            )}
            style={{ fontSize: size }}
          >
            {filled ? "★" : "☆"}
          </button>
        );
      })}
    </div>
  );
}
