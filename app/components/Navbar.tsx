import { Link, useLocation } from "@remix-run/react";
import { buttonVariants } from "./ui/button";
import { SearchMovies } from "./SearchMovies";

export function Navbar() {
  const location = useLocation();
  const pathname = location.pathname;
  return (
    <>
      {pathname === "/login" ? null : (
        <header className="flex py-4 items-center justify-between shadow-md pl-4">
          <Link className="font-bold" to="/">
            Movie Vibes
          </Link>

          <div>
            <SearchMovies />
          </div>

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
      )}
    </>
  );
}
