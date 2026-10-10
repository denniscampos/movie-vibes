import { describe, it, expect } from "vitest";
import { resolveAllowedActionOrigins } from "../config/allowed-action-origins";

describe("resolveAllowedActionOrigins", () => {
  it("returns undefined when nothing is configured", () => {
    expect(resolveAllowedActionOrigins({})).toBeUndefined();
    expect(
      resolveAllowedActionOrigins({ ALLOWED_ACTION_ORIGINS: " , " }),
    ).toBeUndefined();
  });

  it("combines ALLOWED_ACTION_ORIGINS with RAILWAY_PUBLIC_DOMAIN, de-duplicated", () => {
    expect(
      resolveAllowedActionOrigins({
        ALLOWED_ACTION_ORIGINS: "movievibes.example.com, *.example.com",
        RAILWAY_PUBLIC_DOMAIN: "movie-vibes.up.railway.app",
      }),
    ).toEqual([
      "movievibes.example.com",
      "*.example.com",
      "movie-vibes.up.railway.app",
    ]);
    expect(
      resolveAllowedActionOrigins({
        ALLOWED_ACTION_ORIGINS: "Movie-Vibes.up.railway.app",
        RAILWAY_PUBLIC_DOMAIN: "movie-vibes.up.railway.app",
      }),
    ).toEqual(["movie-vibes.up.railway.app"]);
  });

  it.each([
    ["https://movievibes.example.com", "movievibes.example.com"],
    ["https://movievibes.example.com/", "movievibes.example.com"],
    ["http://localhost:3187/login", "localhost:3187"],
    ["movievibes.example.com/", "movievibes.example.com"],
    ["  MovieVibes.Example.com  ", "movievibes.example.com"],
    ["localhost:3187", "localhost:3187"],
  ])("normalizes %j to the bare host %j", (input, expected) => {
    expect(
      resolveAllowedActionOrigins({ ALLOWED_ACTION_ORIGINS: input }),
    ).toEqual([expected]);
  });

  it.each([
    "*",
    "**",
    "https://**",
    "*.*",
    "*.com",
    "*.**.example.com",
    "not a host",
    "https://",
  ])(
    "rejects %j, which would match everything or nothing",
    (input) => {
      expect(() =>
        resolveAllowedActionOrigins({ ALLOWED_ACTION_ORIGINS: input }),
      ).toThrow(/ALLOWED_ACTION_ORIGINS/);
    },
  );
});
