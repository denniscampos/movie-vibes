import { verifyKey } from "discord-interactions";
import { MovieStatus } from "~/lib/generated/prisma/enums";

export const INTERACTION_PING = 1;
export const INTERACTION_APPLICATION_COMMAND = 2;
const RESPONSE_PONG = 1;
const RESPONSE_CHANNEL_MESSAGE = 4;
const RESPONSE_DEFERRED_CHANNEL_MESSAGE = 5;
export const FLAG_EPHEMERAL = 64;

export type DiscordUser = {
  id?: string;
  username?: string;
  global_name?: string | null;
};

export type DiscordInteraction = {
  type?: number;
  token?: string;
  guild_id?: string;
  member?: { user?: DiscordUser };
  user?: DiscordUser;
  data?: {
    name?: string;
    options?: { name: string; value?: unknown; focused?: boolean }[];
  };
};

export type TmdbSearchResult = {
  id: number;
  title: string;
  release_date?: string | null;
  poster_path?: string | null;
  vote_count?: number;
};

export const MSG_NOT_SUPPORTED = "This command is not supported.";
export const MSG_NOT_AVAILABLE = "This command isn't available here.";
export const MSG_NO_TITLE = "Please provide a movie title.";
export const MSG_EXISTS = "This movie already exists.";
export const MSG_ERROR = "Something went wrong adding that movie. Please try again.";
export const MSG_RANDOM_ERROR =
  "Something went wrong picking a movie. Please try again.";

export async function verifyDiscordRequest(
  request: Request,
  rawBody: string,
  publicKey: string | undefined,
): Promise<boolean> {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  if (!signature || !timestamp || !publicKey) return false;
  try {
    return (await verifyKey(rawBody, signature, timestamp, publicKey)) === true;
  } catch {
    return false;
  }
}

export const pongResponse = () =>
  Response.json({ type: RESPONSE_PONG }, { status: 200 });

export const ephemeralMessage = (content: string) =>
  Response.json({
    type: RESPONSE_CHANNEL_MESSAGE,
    data: { content, flags: FLAG_EPHEMERAL },
  });

export const deferredPublic = () =>
  Response.json({ type: RESPONSE_DEFERRED_CHANNEL_MESSAGE });

export function parseIdList(value: string | undefined | null): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getInvokerId(interaction: DiscordInteraction) {
  return interaction.member?.user?.id ?? interaction.user?.id;
}

export function isInvocationAllowed(
  interaction: DiscordInteraction,
  allowedGuildIds: string[],
  allowedUserIds: string[],
): boolean {
  const userId = getInvokerId(interaction);
  if (!interaction.guild_id) {
    // Bot DM or group DM: only explicitly allowlisted users.
    return (
      allowedUserIds.length > 0 && !!userId && allowedUserIds.includes(userId)
    );
  }
  if (allowedGuildIds.length === 0) return false;
  if (!allowedGuildIds.includes(interaction.guild_id)) return false;
  if (allowedUserIds.length > 0) {
    if (!userId || !allowedUserIds.includes(userId)) return false;
  }
  return true;
}

export function getInvokerName(interaction: DiscordInteraction): string {
  return (
    interaction.member?.user?.global_name ??
    interaction.member?.user?.username ??
    interaction.user?.global_name ??
    interaction.user?.username ??
    "Discord"
  );
}

export function getStringOption(
  interaction: DiscordInteraction,
  name: string,
): string | undefined {
  const value = interaction.data?.options?.find((o) => o.name === name)?.value;
  return typeof value === "string" ? value : undefined;
}

export function buildSaveInput(
  result: TmdbSearchResult,
  interaction: DiscordInteraction,
) {
  const pickedBy = getStringOption(interaction, "picked-by")?.trim();
  return {
    movieName: result.title,
    releaseDate: (result.release_date ?? "").slice(0, 4),
    selectedBy: pickedBy || getInvokerName(interaction),
    categoryName: getStringOption(interaction, "category")?.trim() ?? "",
    status: MovieStatus.UPCOMING,
    imageUrl: result.poster_path ?? undefined,
    tmdbId: result.id,
  };
}

export function buildSuccessMessage(
  result: TmdbSearchResult,
  selectedBy: string,
  categoryName = "",
): string {
  const where = categoryName ? ` under **${categoryName}**` : "";
  return `Added **${formatLabel(result)}** to Movie Vibes${where} — picked by ${selectedBy}.`;
}

export const buildNotFoundMessage = (title: string) =>
  `Couldn't find a movie matching "${title}". Check the spelling, or pick from the suggestions that appear as you type.`;

// --- Autocomplete --------------------------------------------------------

export const INTERACTION_AUTOCOMPLETE = 4;
const RESPONSE_AUTOCOMPLETE_RESULT = 8;
// Discord limits: 25 choices, 100 characters per choice name and value.
const MAX_CHOICES = 25;
const MAX_CHOICE_LENGTH = 100;
export const MIN_AUTOCOMPLETE_QUERY = 2;

export type AutocompleteChoice = { name: string; value: string };

export const autocompleteResponse = (choices: AutocompleteChoice[]) =>
  Response.json({ type: RESPONSE_AUTOCOMPLETE_RESULT, data: { choices } });

export function getFocusedOption(interaction: DiscordInteraction): {
  name: string;
  value: string;
} {
  const option = interaction.data?.options?.find((o) => o.focused);
  return {
    name: option?.name ?? "",
    value: typeof option?.value === "string" ? option.value.trim() : "",
  };
}

// Category names are their own value, so free text and picks behave the same.
export const buildCategoryChoices = (names: string[]): AutocompleteChoice[] =>
  names
    .filter((name) => name.length <= MAX_CHOICE_LENGTH)
    .slice(0, MAX_CHOICES)
    .map((name) => ({ name, value: name }));

// A picked suggestion submits "tmdb:<id>" instead of free text.
const CHOICE_PREFIX = "tmdb:";

export function parseTmdbChoice(value: string): number | undefined {
  const match = /^tmdb:(\d{1,10})$/.exec(value);
  return match ? Number(match[1]) : undefined;
}

function formatLabel(result: TmdbSearchResult): string {
  const year = (result.release_date ?? "").slice(0, 4);
  return year ? `${result.title} (${year})` : result.title;
}

export function buildChoices(results: TmdbSearchResult[]): AutocompleteChoice[] {
  return results.slice(0, MAX_CHOICES).map((result) => {
    const label = formatLabel(result);
    return {
      name:
        label.length > MAX_CHOICE_LENGTH
          ? `${label.slice(0, MAX_CHOICE_LENGTH - 1)}…`
          : label,
      value: `${CHOICE_PREFIX}${result.id}`,
    };
  });
}

// --- Ranking -------------------------------------------------------------

// Lowercase, strip accents and punctuation so "crouching tiger hidden dragon"
// equals "Crouching Tiger, Hidden Dragon".
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Exact title matches first (most-voted first, so the well-known film beats a
 * remake or short with the same name), then TMDB's own relevance order.
 */
export function rankResults(
  results: TmdbSearchResult[],
  query: string,
): TmdbSearchResult[] {
  const target = normalizeTitle(query);
  const exact = results
    .filter((r) => normalizeTitle(r.title) === target)
    .sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0));
  return [...exact, ...results.filter((r) => !exact.includes(r))];
}

// --- Mark watched --------------------------------------------------------

export type UpcomingMovie = { id: string; movieName: string; releaseDate: string };

const MOVIE_CHOICE_PREFIX = "movie:";

export const MSG_NO_MOVIE = "Please pick a movie to mark as watched.";
export const MSG_MARK_WATCHED_ERROR =
  "Something went wrong marking that movie as watched. Please try again.";
export const MSG_NO_UPCOMING_MATCH =
  "No upcoming movie matched that. Pick one from the suggestions that appear as you type.";
export const MSG_AMBIGUOUS_UPCOMING =
  "More than one upcoming movie has that name. Pick one from the suggestions that appear as you type.";

export function parseMovieChoice(value: string): string | undefined {
  const match = /^movie:(\S+)$/.exec(value);
  return match ? match[1] : undefined;
}

export function formatMovieLabel(movie: {
  movieName: string;
  releaseDate: string;
}): string {
  return movie.releaseDate
    ? `${movie.movieName} (${movie.releaseDate})`
    : movie.movieName;
}

export function buildMovieChoices(movies: UpcomingMovie[]): AutocompleteChoice[] {
  return movies
    .map((movie) => ({
      name: truncateChoiceName(formatMovieLabel(movie)),
      value: `${MOVIE_CHOICE_PREFIX}${movie.id}`,
    }))
    .filter((choice) => choice.value.length <= MAX_CHOICE_LENGTH)
    .slice(0, MAX_CHOICES);
}

function truncateChoiceName(label: string): string {
  return label.length > MAX_CHOICE_LENGTH
    ? `${label.slice(0, MAX_CHOICE_LENGTH - 1)}…`
    : label;
}

export const buildMarkedWatchedMessage = (movie: {
  movieName: string;
  releaseDate: string;
}) => `✅ Marked **${formatMovieLabel(movie)}** as watched.`;

// --- Spin ----------------------------------------------------------------

export const MSG_NO_UPCOMING_PICKERS =
  "No upcoming movies to spin for. Add one with /add-movie.";
export const MSG_SPIN_ERROR =
  "Something went wrong spinning the wheel. Please try again.";

export const buildSpinMessage = (name: string) =>
  `🎡 The wheel has spoken: **${name}** is picking tonight!`;

// --- Random pick ---------------------------------------------------------

export type RandomPick = {
  movieName: string;
  releaseDate: string;
  selectedBy: string;
  category: { name: string };
};

export function buildRandomPickMessage(pick: RandomPick): string {
  const label = pick.releaseDate
    ? `${pick.movieName} (${pick.releaseDate})`
    : pick.movieName;
  const category = pick.category.name.trim();
  const from = category ? ` from **${category}**` : "";
  return `🎲 The vibes have spoken: **${label}**${from} — picked by ${pick.selectedBy}.`;
}

export const buildNoRandomPickMessage = (categoryName?: string) =>
  categoryName
    ? `No unwatched movies in "${categoryName}". Try another category, or leave it blank to pick from everything.`
    : "No unwatched movies left. Add one with /add-movie.";
