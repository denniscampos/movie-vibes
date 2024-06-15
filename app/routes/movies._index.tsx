import { Link } from "@remix-run/react";

export default function MoviesPage() {
  return (
    <div>
      <h2>Movies Page</h2>
      <Link to="/movies/new">Add New Movie</Link>

      <p>Table here</p>
    </div>
  );
}
