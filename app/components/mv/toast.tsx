import { useEffect, useState } from "react";

const EVENT = "mv-toast";

export function toast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }));
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      setMsg(detail);
      const id = window.setTimeout(() => setMsg(null), 2200);
      return () => window.clearTimeout(id);
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  if (!msg) return null;

  return (
    <div
      className="fixed bottom-[30px] left-1/2 z-1000 -translate-x-1/2 border-2 border-accent bg-ink px-5 py-3 font-hand text-[15px] font-bold text-paper"
      style={{
        boxShadow: "4px 4px 0 hsl(var(--accent))",
        animation: "mv-toast-in 0.25s ease",
      }}
    >
      {msg}
    </div>
  );
}
