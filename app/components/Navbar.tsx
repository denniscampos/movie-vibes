import { Link, useLocation } from "react-router";
import { buttonVariants } from "./ui/button";
import { SearchMovies } from "./SearchMovies";
import { cn } from "~/lib/utils";
import { Clapperboard, Menu, X } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const location = useLocation();
  const pathname = location.pathname;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      {pathname === "/login" ? null : (
        <header className="flex flex-col sm:flex-row py-4 items-center justify-between shadow-md p-4 sm:p-8">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <Link
              className="text-sm sm:text-base font-bold flex items-center gap-2"
              to="/"
            >
              <Clapperboard className="w-4 h-4" />
              Movie Vibes
            </Link>

            {/* Mobile menu button */}
            <button
              className="sm:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Navigation menu */}
          <nav
            className={`${
              isMenuOpen ? "block" : "hidden"
            } sm:block w-full sm:w-auto mt-4 sm:mt-0`}
          >
            <ul className="flex flex-col sm:flex-row items-center gap-2 sm:gap-0">
              <li className="w-full sm:w-auto text-center">
                <Link
                  className={cn(
                    buttonVariants({ variant: "link" }),
                    "py-1 px-2 md:px-4 md:py-2 text-xs sm:text-sm w-full sm:w-auto"
                  )}
                  to="/"
                >
                  Home
                </Link>
              </li>
              <li className="w-full sm:w-auto text-center">
                <Link
                  className={cn(
                    buttonVariants({ variant: "link" }),
                    "py-1 px-2 md:px-4 md:py-2 text-xs sm:text-sm w-full sm:w-auto"
                  )}
                  to="/browse"
                >
                  Browse
                </Link>
              </li>
              <li className="w-full sm:w-auto text-center">
                <Link
                  className={cn(
                    buttonVariants({ variant: "link" }),
                    "py-1 px-2 md:px-4 md:py-2 text-xs sm:text-sm w-full sm:w-auto"
                  )}
                  to="/movies"
                >
                  Database
                </Link>
              </li>
              <li className="w-full sm:w-auto text-center">
                <Link
                  className={cn(
                    buttonVariants({ variant: "link" }),
                    "py-1 px-2 md:px-4 md:py-2 text-xs sm:text-sm w-full sm:w-auto"
                  )}
                  to="/movies/new"
                >
                  Add Movie
                </Link>
              </li>
            </ul>
          </nav>

          <div className="w-full sm:w-auto mt-4 sm:mt-0">
            <SearchMovies />
          </div>
        </header>
      )}
    </>
  );
}
