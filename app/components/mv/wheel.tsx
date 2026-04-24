import { useState } from "react";

export type WheelName = { id: string; name: string };

type WheelProps = {
  names: WheelName[];
  onResult?: (winner: WheelName) => void;
  size?: number;
};

export function Wheel({ names, onResult, size = 380 }: WheelProps) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const wedges = names.length;
  const wedgeAngle = wedges > 0 ? 360 / wedges : 0;

  const spin = () => {
    if (spinning || wedges === 0) return;
    setSpinning(true);
    const winnerIdx = Math.floor(Math.random() * wedges);

    // Pointer sits at 12 o'clock (270° CW from the +X axis). Wedge i's center
    // starts at (i * wedgeAngle + wedgeAngle / 2). For the winner to land under
    // the pointer, the disc's absolute rotation R (mod 360) must satisfy
    // (i * wedgeAngle + wedgeAngle / 2 + R) mod 360 === 270.
    const desiredMod =
      (((270 - winnerIdx * wedgeAngle - wedgeAngle / 2) % 360) + 360) % 360;
    const currentMod = ((rotation % 360) + 360) % 360;
    const delta = (((desiredMod - currentMod) % 360) + 360) % 360 + 360 * 5;

    setRotation((r) => r + delta);
    window.setTimeout(() => {
      setSpinning(false);
      onResult?.(names[winnerIdx]);
    }, 3800);
  };

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {/* Pointer */}
      <div
        className="absolute left-1/2 z-3 -translate-x-1/2"
        style={{
          top: -4,
          width: 0,
          height: 0,
          borderLeft: "14px solid transparent",
          borderRight: "14px solid transparent",
          borderTop: "22px solid hsl(var(--accent))",
          filter: "drop-shadow(0 2px 0 hsl(var(--ink-line)))",
        }}
      />
      {/* Disc */}
      <div
        className="absolute inset-0 overflow-hidden rounded-full border-4 border-ink-line bg-card shadow-ink-lg"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning
            ? "transform 3.7s cubic-bezier(0.17, 0.67, 0.15, 1)"
            : "none",
        }}
      >
        {names.map((n, i) => (
          <div
            key={n.id}
            className="absolute inset-0"
            style={{ transform: `rotate(${i * wedgeAngle}deg)` }}
          >
            <div
              className="absolute font-hand-2 text-lg font-bold"
              style={{
                top: "50%",
                left: "55%",
                transformOrigin: "0 0",
                transform: `rotate(${wedgeAngle / 2}deg) translate(30px, -10px)`,
                color: i % 2 ? "hsl(var(--ink))" : "hsl(var(--accent))",
              }}
            >
              {n.name.toUpperCase()}
            </div>
          </div>
        ))}
        {names.map((_, i) => (
          <div
            key={i}
            className="absolute bg-ink-line"
            style={{
              top: "50%",
              left: "50%",
              width: "50%",
              height: 2,
              transform: `rotate(${i * wedgeAngle}deg)`,
              transformOrigin: "0 50%",
            }}
          />
        ))}
      </div>
      {/* Hub */}
      <button
        type="button"
        onClick={spin}
        disabled={spinning}
        className="absolute left-1/2 top-1/2 z-2 flex size-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-ink-line bg-accent font-hand-2 text-[15px] font-bold text-accent-ink disabled:cursor-wait"
        style={{ boxShadow: "0 0 0 2px hsl(var(--paper))" }}
      >
        {spinning ? "..." : "SPIN"}
      </button>
    </div>
  );
}
