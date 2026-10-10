/**
 * Hosts React Router accepts form submissions (actions) from, besides the
 * request's own origin. Behind Railway's TLS proxy the server sees http://
 * while browsers send `Origin: https://...`, so the public host must be listed
 * or every action is rejected with 400 "Bad Request".
 *
 * Read at build time: the list is baked into the server build.
 */
type Env = Record<string, string | undefined>;

const HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)*(:\d{1,5})?$/;
// React Router supports `**.` only as the leftmost label, `*.` anywhere before.
const WILDCARD = /^(\*\*\.|(\*\.)+)/;

function toHost(entry: string): string {
  const value = entry.trim().toLowerCase();
  let host: string;
  if (value.includes("://")) {
    try {
      host = new URL(value).host;
    } catch {
      host = "";
    }
  } else {
    host = value.split("/")[0];
  }

  // Wildcards (`*.` / `**.`) may only lead and must leave a real domain, so a
  // typo such as `*` or `**` can't switch the origin check off entirely.
  const rest = host.replace(WILDCARD, "");
  const wildcard = rest !== host;
  if (!HOST.test(rest) || (wildcard && !rest.includes("."))) {
    throw new Error(
      `ALLOWED_ACTION_ORIGINS: "${entry.trim()}" is not a host such as "movievibes.example.com" or "*.example.com".`,
    );
  }
  return host;
}

export function resolveAllowedActionOrigins(env: Env): string[] | undefined {
  const entries = [
    ...(env.ALLOWED_ACTION_ORIGINS ?? "").split(","),
    env.RAILWAY_PUBLIC_DOMAIN ?? "",
  ].filter((entry) => entry.trim());
  const hosts = [...new Set(entries.map(toHost))];
  return hosts.length > 0 ? hosts : undefined;
}
