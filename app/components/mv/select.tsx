import type { Ref, SelectHTMLAttributes } from "react";
import { cn } from "~/lib/utils";

export type SelectOption = { value: string; label: string } | string;

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options: SelectOption[];
  ref?: Ref<HTMLSelectElement>;
};

function optValue(o: SelectOption) {
  return typeof o === "string" ? o : o.value;
}
function optLabel(o: SelectOption) {
  return typeof o === "string" ? o : o.label;
}

export function Select({
  label,
  error,
  options,
  className,
  id,
  name,
  ref,
  ...rest
}: SelectProps) {
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
      <select
        ref={ref}
        id={resolvedId}
        name={name}
        className={cn(
          "w-full cursor-pointer appearance-none rounded-organic-sm border-2 border-ink-line bg-card px-[14px] py-[10px] font-hand text-[15px] text-ink outline-none focus:border-accent",
          error && "border-destructive",
          className,
        )}
        {...rest}
      >
        {options.map((o) => (
          <option key={optValue(o)} value={optValue(o)} className="bg-card">
            {optLabel(o)}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-[4px] font-hand text-[13px] text-destructive">{error}</p>
      )}
    </div>
  );
}
