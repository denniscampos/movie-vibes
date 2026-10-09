import type { Route } from "./+types/api.discord.interactions";
import { searchMovie } from "services/tmdb";
import { findMovieByTmdbId, saveToDB } from "~/models/movie.server";
import {
  INTERACTION_APPLICATION_COMMAND,
  INTERACTION_PING,
  MSG_ERROR,
  MSG_EXISTS,
  MSG_NOT_AVAILABLE,
  MSG_NOT_SUPPORTED,
  MSG_NO_TITLE,
  buildNotFoundMessage,
  buildSaveInput,
  buildSuccessMessage,
  deferredEphemeral,
  ephemeralMessage,
  getStringOption,
  isInvocationAllowed,
  parseIdList,
  pongResponse,
  verifyDiscordRequest,
  type DiscordInteraction,
} from "~/utils/discord.server";

async function addMovie(interaction: DiscordInteraction, title: string) {
  try {
    const results = await searchMovie(title);
    if (!results || results.length === 0) return buildNotFoundMessage(title);

    const first = results[0];
    if (await findMovieByTmdbId(first.id)) return MSG_EXISTS;

    const input = buildSaveInput(first, interaction);
    await saveToDB(input);
    return buildSuccessMessage(first, input.selectedBy);
  } catch (error) {
    // Log only the error message: never the interaction token or payload.
    console.error(
      "Discord add-movie failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return MSG_ERROR;
  }
}

async function sendFollowUp(token: string, content: string) {
  try {
    const res = await fetch(
      `https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${token}/messages/@original`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      },
    );
    if (!res.ok) {
      console.error("Discord follow-up failed with status", res.status);
    }
  } catch {
    // Error text may embed the request URL (which contains the token).
    console.error("Discord follow-up request failed");
  }
}

export async function action({ request }: Route.ActionArgs) {
  const rawBody = await request.text();

  const verified = await verifyDiscordRequest(
    request,
    rawBody,
    process.env.DISCORD_PUBLIC_KEY,
  );
  if (!verified) {
    return new Response("Invalid request signature", { status: 401 });
  }

  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!interaction || typeof interaction !== "object") {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (interaction.type === INTERACTION_PING) return pongResponse();

  if (
    interaction.type !== INTERACTION_APPLICATION_COMMAND ||
    interaction.data?.name !== "add-movie"
  ) {
    return ephemeralMessage(MSG_NOT_SUPPORTED);
  }

  if (
    !isInvocationAllowed(
      interaction,
      parseIdList(process.env.DISCORD_ALLOWED_GUILD_IDS),
      parseIdList(process.env.DISCORD_ALLOWED_USER_IDS),
    )
  ) {
    return ephemeralMessage(MSG_NOT_AVAILABLE);
  }

  const title = (getStringOption(interaction, "title") ?? "").trim();
  if (!title) return ephemeralMessage(MSG_NO_TITLE);

  // Deferred strategy: TMDB + DB work can exceed Discord's 3-second window for
  // an initial response, so we acknowledge immediately with a deferred
  // ephemeral reply and edit the original message once the work finishes.
  // The webhook PATCH is authenticated by the interaction token alone.
  const token = interaction.token;
  if (token) {
    void addMovie(interaction, title).then((content) =>
      sendFollowUp(token, content),
    );
  }

  return deferredEphemeral();
}
