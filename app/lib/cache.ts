import { LRUCache } from "lru-cache";
import { Genre, MovieAPIResponse } from "types/movie";

export function createCache<T>() {
  return new LRUCache<string, Map<number, T>>({
    max: 500,
    ttl: 1000 * 60 * 60 * 24, // TTL: 24 hrs in milliseconds
  });
}

// Cache list
export const genreCache = createCache<Genre>();
export const releaseCache = createCache<MovieAPIResponse>();
export const recommendedCache = createCache<MovieAPIResponse>();
