interface MovieListProps {
  id: number;
  title: string;
  releaseDate: string;
  posterPath: string;
}

export function MovieList({ movies }: { movies: MovieListProps[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-5">
      {movies &&
        movies.map(
          (movie: {
            id: number;
            posterPath: string;
            title: string;
            releaseDate: string;
          }) => (
            <div
              key={movie.id}
              className="bg-white shadow-lg rounded-lg overflow-hidden hover:shadow-xl transition-shadow duration-300"
            >
              <div className="h-64 overflow-hidden">
                {movie.posterPath ? (
                  <img
                    src={movie.posterPath}
                    alt={movie.title}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full bg-gray-200">
                    <span className="text-gray-500">No Image Available</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-800">{movie.title}</h3>
                <p className="text-gray-600">{movie.releaseDate}</p>
              </div>
            </div>
          )
        )}
    </div>
  );
}
