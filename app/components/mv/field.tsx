import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "~/lib/utils";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  ref?: Ref<HTMLInputElement>;
};

export function Field({
  label,
  error,
  className,
  id,
  name,
  ref,
  ...rest
}: FieldProps) {
  const resolvedId = id ?? name;
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={resolvedId}
          className="mb-[6px] block font-mono text-[10px] uppercase tracking-[0.12em] text-muted"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={resolvedId}
        name={name}
        className={cn(
          "w-full rounded-organic-sm border-2 border-ink-line bg-card px-[14px] py-[10px] font-hand text-[15px] text-ink outline-none focus:border-accent",
          error && "border-destructive",
          className,
        )}
        {...rest}
      />
      {error && (
        <p className="mt-[4px] font-hand text-[13px] text-destructive">{error}</p>
      )}
    </div>
  );
}
