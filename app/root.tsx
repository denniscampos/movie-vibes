import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from "react-router";
import stylesheet from "~/tailwind.css?url";

import type { LinksFunction } from "react-router";
import { Navbar } from "./components/Navbar";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: stylesheet }];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Movie Vibes</title>
        <meta property="og:title" content="Movie Vibes" />
        <meta name="description" content="Movie Vibes" />
        <Links />
      </head>
      <body>
        <Navbar />
        <div className="max-w-7xl mx-auto px-4">
          {children}
          <ScrollRestoration />
          <Scripts />
        </div>
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error({ error });
  return (
    <html lang="es">
      <head>
        <title>Oh no!</title>
        <Meta />
        <Links />
      </head>
      <body>
        <p>Something went wrong. Please try again later.</p>
        <Scripts />
      </body>
    </html>
  );
}
