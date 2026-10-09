/**
 * Discord command definitions. Keep this module free of server-only,
 * database and network imports so the registration script can import it.
 */
export const addMovieCommand = {
  name: "add-movie",
  description: "Add a movie to Movie Vibes",
  // 0 = guild install, 1 = user install
  integration_types: [0, 1],
  // 0 = guild, 1 = bot DM, 2 = private channel / group DM
  contexts: [0, 1, 2],
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
};
