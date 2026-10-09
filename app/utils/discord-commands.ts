/**
 * Discord command definitions. Keep this module free of server-only,
 * database and network imports so the registration script can import it.
 */
// Shared install/context settings for every command.
// 0 = guild install, 1 = user install
const integration_types = [0, 1];
// 0 = guild, 1 = bot DM, 2 = private channel / group DM
const contexts = [0, 1, 2];

export const addMovieCommand = {
  name: "add-movie",
  description: "Add a movie to Movie Vibes",
  integration_types,
  contexts,
  options: [
    {
      name: "title",
      description: "Movie title to add",
      type: 3,
      required: true,
      // Suggests TMDB matches while typing (handled in the interactions route).
      autocomplete: true,
    },
    {
      name: "picked-by",
      description: "Who is picking this movie (defaults to your Discord name)",
      type: 3,
      required: false,
    },
    {
      name: "category",
      description: "Category for this movie (suggests ones already in use)",
      type: 3,
      required: false,
      max_length: 100,
      autocomplete: true,
    },
  ],
};

export const randomMovieCommand = {
  name: "random-movie",
  description: "Pick a random movie we haven't watched yet",
  integration_types,
  contexts,
  options: [
    {
      name: "category",
      description: "Only pick from this category",
      type: 3,
      required: false,
      autocomplete: true,
    },
  ],
};

export const commands = [addMovieCommand, randomMovieCommand];
