import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";
import stylesheet from "~/tailwind.css?url";

import type { LinksFunction } from "@remix-run/node";
import { Navbar } from "./components/Navbar";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: stylesheet }];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <div className="max-w-7xl mx-auto">
          <Navbar />
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
