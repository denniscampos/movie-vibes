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
    options?: { name: string; value?: unknown }[];
  };
};

export type TmdbSearchResult = {
  id: number;
  title: string;
  release_date?: string | null;
  poster_path?: string | null;
};

export const MSG_NOT_SUPPORTED = "This command is not supported.";
export const MSG_NOT_AVAILABLE = "This command isn't available here.";
export const MSG_NO_TITLE = "Please provide a movie title.";
export const MSG_EXISTS = "This movie already exists.";
export const MSG_ERROR = "Something went wrong adding that movie. Please try again.";

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
    categoryName: "",
    status: MovieStatus.UPCOMING,
    imageUrl: result.poster_path ?? undefined,
    tmdbId: result.id,
  };
}

export function buildSuccessMessage(
  result: TmdbSearchResult,
  selectedBy: string,
): string {
  const year = (result.release_date ?? "").slice(0, 4);
  const label = year ? `${result.title} (${year})` : result.title;
  return `Added **${label}** to Movie Vibes — picked by ${selectedBy}.`;
}

export const buildNotFoundMessage = (title: string) =>
  `Couldn't find a movie matching "${title}".`;
