/**
 * Who has an upcoming movie, as shown on the home-page wheel and by /spin.
 * Distinct by exact string; blank names are dropped. Keep this module free
 * of server-only imports: the home route renders it on the client.
 */
export function uniquePickerNames(
  selectedBys: ReadonlyArray<string | null | undefined>,
): string[] {
  return Array.from(
    new Set(
      selectedBys.filter((n): n is string => Boolean(n && n.trim())),
    ),
  );
}
