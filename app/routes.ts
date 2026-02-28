import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  index("./routes/home.tsx"),
  route("login", "./routes/login.tsx"),
  route("movies", "./routes/movies/index.tsx"),
  route("movies/new", "./routes/movies/new.tsx"),
  route("movies/:id", "./routes/movies/movie.tsx"),
  route("movies/genre/:genreId", "./routes/movies/genre/genreId.tsx"),
  route("search", "./routes/search.tsx"),
  route("browse", "./routes/browse.tsx"),
] satisfies RouteConfig;
