import { Link, useLocation } from "@remix-run/react";
import { buttonVariants } from "./ui/button";
import { SearchMovies } from "./SearchMovies";
import { cn } from "~/lib/utils";

export function Navbar() {
  const location = useLocation();
  const pathname = location.pathname;
  return (
    <>
      {pathname === "/login" ? null : (
        <header className="flex py-4 items-center justify-between shadow-md pl-4">
          <Link className="text-sm sm:text-base font-bold" to="/">
            Movie Vibes
          </Link>

          <div>
            <SearchMovies />
          </div>

          <ul className="flex items-center">
            <li>
              <Link
                className={cn(
                  buttonVariants({ variant: "link" }),
                  "py-1 px-2 md:px-4 md:py-2 text-xs sm:text-base"
                )}
                to="/movies"
              >
                Movies
              </Link>
            </li>
            <li>
              <Link
                className={cn(
                  buttonVariants({ variant: "link" }),
                  "py-1 px-2 md:px-4 md:py-2 text-xs sm:text-base"
                )}
                to="/movies/new"
              >
                Add Movie
              </Link>
            </li>
          </ul>
        </header>
      )}
    </>
  );
}
