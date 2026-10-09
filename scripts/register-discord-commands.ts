/**
 * Registers the /add-movie guild command with Discord (idempotent PUT).
 *
 * Usage:
 *   pnpm discord:register
 */

const required = [
  "DISCORD_APPLICATION_ID",
  "DISCORD_GUILD_ID",
  "DISCORD_BOT_TOKEN",
] as const;

const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing required env var(s): ${missing.join(", ")}`);
  process.exit(1);
}

const commands = [
  {
    name: "add-movie",
    description: "Add a movie to Movie Vibes",
    options: [
      {
        name: "title",
        description: "Movie title to add",
        type: 3,
        required: true,
      },
      {
        name: "picked-by",
        description: "Who is picking this movie (defaults to your Discord name)",
        type: 3,
        required: false,
      },
    ],
  },
];

const res = await fetch(
  `https://discord.com/api/v10/applications/${process.env.DISCORD_APPLICATION_ID}/guilds/${process.env.DISCORD_GUILD_ID}/commands`,
  {
    method: "PUT",
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  },
);

if (!res.ok) {
  console.error(`Discord returned HTTP ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}

console.log(`Registered ${commands.length} command(s) (HTTP ${res.status}).`);

export {};
