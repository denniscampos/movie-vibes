import type { Route } from "./+types/api.discord.interactions";
import { searchMovie, searchMovieById } from "services/tmdb";
import { createMovie, findMovieByTmdbId } from "~/models/movie.server";
import {
  INTERACTION_APPLICATION_COMMAND,
  INTERACTION_AUTOCOMPLETE,
  MIN_AUTOCOMPLETE_QUERY,
  INTERACTION_PING,
  MSG_ERROR,
  MSG_EXISTS,
  MSG_NOT_AVAILABLE,
  MSG_NOT_SUPPORTED,
  MSG_NO_TITLE,
  autocompleteResponse,
  buildChoices,
  buildNotFoundMessage,
  buildSaveInput,
  buildSuccessMessage,
  FLAG_EPHEMERAL,
  deferredPublic,
  ephemeralMessage,
  getFocusedValue,
  getStringOption,
  isInvocationAllowed,
  parseIdList,
  parseTmdbChoice,
  pongResponse,
  rankResults,
  verifyDiscordRequest,
  type DiscordInteraction,
  type TmdbSearchResult,
} from "~/utils/discord.server";

type Outcome = { content: string; success: boolean };

// Autocomplete replies cannot be deferred and must arrive within 3 seconds.
const AUTOCOMPLETE_TIMEOUT_MS = 2500;

async function suggestMovies(query: string): Promise<Response> {
  if (query.length < MIN_AUTOCOMPLETE_QUERY) return autocompleteResponse([]);
  try {
    const results = await Promise.race<TmdbSearchResult[] | undefined>([
      searchMovie(query),
      new Promise((resolve) =>
        setTimeout(() => resolve(undefined), AUTOCOMPLETE_TIMEOUT_MS),
      ),
    ]);
    return autocompleteResponse(buildChoices(rankResults(results ?? [], query)));
  } catch {
    console.error("Discord autocomplete search failed");
    return autocompleteResponse([]);
  }
}

// A picked suggestion ("tmdb:<id>") is fetched exactly; free text falls back
// to a search and the best-ranked result.
async function resolveMovie(
  title: string,
): Promise<TmdbSearchResult | undefined> {
  const tmdbId = parseTmdbChoice(title);
  if (tmdbId !== undefined) return searchMovieById(String(tmdbId));
  const results: TmdbSearchResult[] = (await searchMovie(title)) ?? [];
  return rankResults(results, title)[0];
}

async function addMovie(
  interaction: DiscordInteraction,
  title: string,
): Promise<Outcome> {
  try {
    const movie = await resolveMovie(title);
    if (!movie) {
      return { content: buildNotFoundMessage(title), success: false };
    }

    if (await findMovieByTmdbId(movie.id)) {
      return { content: MSG_EXISTS, success: false };
    }

    const input = buildSaveInput(movie, interaction);
    await createMovie(input);
    return {
      content: buildSuccessMessage(movie, input.selectedBy),
      success: true,
    };
  } catch (error) {
    // Log only the error message: never the interaction token or payload.
    console.error(
      "Discord add-movie failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return { content: MSG_ERROR, success: false };
  }
}

// Never throws and never logs the URL or token (error text may embed the URL).
async function discordRequest(
  step: string,
  url: string,
  method: "PATCH" | "DELETE" | "POST",
  body?: Record<string, unknown>,
) {
  try {
    const res = await fetch(url, {
      method,
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    if (!res.ok) {
      console.error(`Discord ${step} failed with status`, res.status);
    }
  } catch {
    console.error(`Discord ${step} request failed`);
  }
}

async function sendFollowUp(token: string, { content, success }: Outcome) {
  const base = `https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${token}`;
  if (success) {
    await discordRequest("edit", `${base}/messages/@original`, "PATCH", {
      content,
    });
    return;
  }
  await discordRequest("delete", `${base}/messages/@original`, "DELETE");
  await discordRequest("follow-up", base, "POST", {
    content,
    flags: FLAG_EPHEMERAL,
  });
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
    interaction.type === INTERACTION_AUTOCOMPLETE &&
    interaction.data?.name === "add-movie"
  ) {
    const allowed = isInvocationAllowed(
      interaction,
      parseIdList(process.env.DISCORD_ALLOWED_GUILD_IDS),
      parseIdList(process.env.DISCORD_ALLOWED_USER_IDS),
    );
    // Outside the allowlist: no suggestions (the command itself is refused).
    if (!allowed) return autocompleteResponse([]);
    return suggestMovies(getFocusedValue(interaction));
  }

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
  // an initial response, so we acknowledge immediately with a deferred reply.
  // A deferred response's visibility cannot be changed by editing it, so the
  // deferral is PUBLIC (no flags) and:
  //  - success: PATCH @original with the confirmation (stays public);
  //  - anything else: DELETE @original (drops the public "thinking..."
  //    placeholder), then POST an ephemeral (flags 64) follow-up, sent even if
  //    the DELETE fails.
  // The webhook calls are authenticated by the interaction token alone.
  const token = interaction.token;
  if (token) {
    void addMovie(interaction, title)
      .then((outcome) => sendFollowUp(token, outcome))
      .catch(() => console.error("Discord follow-up failed"));
  }

  return deferredPublic();
}
