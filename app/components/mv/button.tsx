import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "~/lib/utils";

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  variant?: "default" | "primary";
  size?: "sm" | "md";
};

export function Button({
  children,
  variant = "default",
  size = "md",
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const isSm = size === "sm";
  const isPrimary = variant === "primary";

  return (
    <button
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 border-2 border-ink-line font-hand font-bold rounded-organic",
        isSm ? "px-3 py-[6px] text-[13px] shadow-ink-sm" : "px-[18px] py-[10px] text-[15px] shadow-ink",
        isPrimary ? "bg-accent text-accent-ink" : "bg-card text-ink",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
