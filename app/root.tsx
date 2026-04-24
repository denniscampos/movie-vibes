import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useRouteError,
} from "react-router";
import stylesheet from "~/tailwind.css?url";

import type { LinksFunction } from "react-router";
import { ToastHost, TopNav } from "./components/mv";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Architects+Daughter&family=IBM+Plex+Mono&display=swap",
  },
  { rel: "stylesheet", href: stylesheet },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <title>Movie Vibes</title>
        <meta property="og:title" content="Movie Vibes" />
        <meta name="description" content="Movie Vibes" />
        <Links />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <ToastHost />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const showNav = pathname !== "/login";

  return (
    <div className="relative z-1 min-h-screen">
      {showNav && <TopNav />}
      <main className="mx-auto max-w-6xl px-5">{children}</main>
    </div>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error({ error });
  return (
    <html lang="en">
      <head>
        <title>Oh no!</title>
        <Meta />
        <Links />
      </head>
      <body>
        <div className="mx-auto max-w-xl px-5 py-20 text-center">
          <p className="font-hand-2 text-3xl text-ink">Something went wrong.</p>
          <p className="font-mono mt-2 text-[11px] uppercase tracking-[0.12em] text-muted">
            please try again later
          </p>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
