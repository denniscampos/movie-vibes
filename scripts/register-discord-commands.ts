/**
 * Registers the /add-movie, /random-movie and /mark-watched commands globally with Discord
 * (idempotent PUT), installable to servers and user accounts, usable in servers, DMs and group
 * DMs. Global commands can take up to an hour to appear.
 *
 * If DISCORD_GUILD_ID is set, the earlier guild-scoped copy of the commands is
 * then removed (PUT an empty list) so the server does not show them twice.
 *
 * Usage:
 *   pnpm discord:register
 */

import { commands } from "../app/utils/discord-commands";

const required = ["DISCORD_APPLICATION_ID", "DISCORD_BOT_TOKEN"] as const;

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing required env var(s): ${missing.join(", ")}`);
  process.exit(1);
}

const appId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const base = `https://discord.com/api/v10/applications/${appId}`;

async function put(label: string, url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`${label} failed: HTTP ${res.status}`);
    console.error(await res.text());
    process.exit(1);
  }
}

await put("Global command registration", `${base}/commands`, commands);

if (guildId) {
  await put(
    "Guild command cleanup",
    `${base}/guilds/${guildId}/commands`,
    [],
  );
}

console.log(
  `Registered ${commands.map((c) => `/${c.name}`).join(", ")} globally.`,
);
console.log("Global commands can take up to an hour to appear.");
console.log(
  guildId
    ? `Cleared guild commands for guild ${guildId}.`
    : "Guild commands were not cleared (DISCORD_GUILD_ID not set).",
);
