import { href, Link, NavLink } from "react-router";
import { cn } from "~/lib/utils";

type NavItem = { to: string; label: string };

type TopNavProps = {
  nav?: NavItem[];
  rightSlot?: React.ReactNode;
};

const DEFAULT_NAV: NavItem[] = [
  { to: href("/"), label: "Home" },
  { to: href("/browse"), label: "Browse" },
  { to: href("/search"), label: "Search" },
  { to: href("/movies"), label: "Library" },
  { to: href("/movies/new"), label: "Add" },
];

export function TopNav({ nav = DEFAULT_NAV, rightSlot }: TopNavProps) {
  return (
    <header className="border-b-2 border-dashed border-rule bg-paper font-hand-2">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-[14px] text-[15px]">
        <Link to="/" className="flex items-center gap-2 font-bold">
          <span className="relative block size-[18px] rounded-full border-2 border-ink-line">
            <span className="absolute inset-[3px] block rounded-full border-[1.5px] border-ink-line" />
          </span>
          Movie Vibes
        </Link>
        <nav className="flex gap-4 text-sm">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end
              className={({ isActive }) =>
                cn(
                  "border-b-2 pb-px",
                  isActive
                    ? "border-accent text-ink"
                    : "border-transparent text-ink-soft hover:text-ink",
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="font-mono text-[11px] text-muted">{rightSlot}</div>
      </div>
    </header>
  );
}
