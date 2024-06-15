import { Link } from "@remix-run/react";
import { buttonVariants } from "./ui/button";

export function Navbar() {
  return (
    <header className="flex py-4 items-center justify-between">
      <Link className="font-bold" to="/">
        Movie Vibes
      </Link>

      <ul className="flex items-center">
        <li>
          <Link className={buttonVariants({ variant: "link" })} to="/movies">
            Movies
          </Link>
        </li>
        <li>
          <Link className={buttonVariants({ variant: "link" })} to="/movies/new">
            Add Movie
          </Link>
        </li>
      </ul>
    </header>
  );
}
