import type { KeyboardEvent } from "react";

/**
 * Props that make a non-button element behave like a button: focusable,
 * announced as a button, and activated by Enter/Space. Returns nothing when
 * there is no handler, so static elements stay static.
 */
export function buttonProps(onClick?: () => void) {
  if (!onClick) return {};
  return {
    role: "button",
    tabIndex: 0,
    onClick,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    },
  } as const;
}
