import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  searchMovie: vi.fn(),
  findMovieByTmdbId: vi.fn(),
  createMovie: vi.fn(),
}));

vi.mock("services/tmdb", () => ({ searchMovie: mocks.searchMovie }));
vi.mock("~/models/movie.server", () => ({
  findMovieByTmdbId: mocks.findMovieByTmdbId,
  createMovie: mocks.createMovie,
}));

import { action } from "~/routes/api.discord.interactions";
import { MovieStatus } from "~/lib/generated/prisma/enums";
import {
  buildSaveInput,
  buildSuccessMessage,
  getInvokerName,
  isInvocationAllowed,
  parseIdList,
  verifyDiscordRequest,
} from "~/utils/discord.server";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicKeyHex = publicKey
  .export({ format: "der", type: "spki" })
  .subarray(-32)
  .toString("hex");

function signed(body: string, timestamp = "1700000000") {
  const signature = sign(null, Buffer.from(timestamp + body), privateKey).toString(
    "hex",
  );
  return { signature, timestamp };
}

function makeRequest(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/discord/interactions", {
    method: "POST",
    body,
    headers,
  });
}

function signedRequest(payload: unknown) {
  const body = JSON.stringify(payload);
  const { signature, timestamp } = signed(body);
  return makeRequest(body, {
    "X-Signature-Ed25519": signature,
    "X-Signature-Timestamp": timestamp,
  });
}

const callAction = (request: Request) =>
  action({ request, params: {}, context: {} } as never) as Promise<Response>;

const command = (over: Record<string, unknown> = {}) => ({
  type: 2,
  token: "secret-token",
  guild_id: "g1",
  member: { user: { id: "u1", username: "uname", global_name: "Display" } },
  data: { name: "add-movie", options: [{ name: "title", value: "Dune" }] },
  ...over,
});

const tmdbResult = {
  id: 42,
  title: "Dune",
  release_date: "2021-09-15",
  poster_path: "https://img/x.jpg",
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.DISCORD_PUBLIC_KEY = publicKeyHex;
  process.env.DISCORD_APPLICATION_ID = "app1";
  process.env.DISCORD_ALLOWED_GUILD_IDS = "g1";
  process.env.DISCORD_ALLOWED_USER_IDS = "";
  fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.searchMovie.mockReset();
  mocks.findMovieByTmdbId.mockReset();
  mocks.createMovie.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function expectNoBackendCalls() {
  expect(mocks.searchMovie).not.toHaveBeenCalled();
  expect(mocks.findMovieByTmdbId).not.toHaveBeenCalled();
  expect(mocks.createMovie).not.toHaveBeenCalled();
}

describe("verifyDiscordRequest", () => {
  const body = '{"type":1}';

  it("accepts a valid signature", async () => {
    const { signature, timestamp } = signed(body);
    const req = makeRequest(body, {
      "X-Signature-Ed25519": signature,
      "X-Signature-Timestamp": timestamp,
    });
    expect(await verifyDiscordRequest(req, body, publicKeyHex)).toBe(true);
  });

  it("rejects a tampered body", async () => {
    const { signature, timestamp } = signed(body);
    const req = makeRequest(body, {
      "X-Signature-Ed25519": signature,
      "X-Signature-Timestamp": timestamp,
    });
    expect(await verifyDiscordRequest(req, '{"type":2}', publicKeyHex)).toBe(false);
  });

  it("rejects a tampered timestamp", async () => {
    const { signature } = signed(body);
    const req = makeRequest(body, {
      "X-Signature-Ed25519": signature,
      "X-Signature-Timestamp": "1700000001",
    });
    expect(await verifyDiscordRequest(req, body, publicKeyHex)).toBe(false);
  });

  it("rejects missing headers, missing key, and malformed key", async () => {
    const { signature, timestamp } = signed(body);
    const headers = {
      "X-Signature-Ed25519": signature,
      "X-Signature-Timestamp": timestamp,
    };
    expect(await verifyDiscordRequest(makeRequest(body), body, publicKeyHex)).toBe(false);
    expect(await verifyDiscordRequest(makeRequest(body, headers), body, "")).toBe(false);
    expect(await verifyDiscordRequest(makeRequest(body, headers), body, undefined)).toBe(false);
    expect(await verifyDiscordRequest(makeRequest(body, headers), body, "zz")).toBe(false);
  });
});

describe("interactions route", () => {
  it("answers PING with PONG", async () => {
    const res = await callAction(signedRequest({ type: 1 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ type: 1 });
    expectNoBackendCalls();
  });

  it("returns 401 for unsigned requests with no backend calls", async () => {
    const res = await callAction(makeRequest(JSON.stringify(command())));
    expect(res.status).toBe(401);
    expectNoBackendCalls();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the public key is not configured", async () => {
    process.env.DISCORD_PUBLIC_KEY = "";
    const res = await callAction(signedRequest({ type: 1 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for a verified non-JSON body", async () => {
    const body = "not json";
    const { signature, timestamp } = signed(body);
    const res = await callAction(
      makeRequest(body, {
        "X-Signature-Ed25519": signature,
        "X-Signature-Timestamp": timestamp,
      }),
    );
    expect(res.status).toBe(400);
    expectNoBackendCalls();
  });

  it("replies not supported for other commands and types", async () => {
    for (const payload of [
      command({ data: { name: "other" } }),
      { type: 3, guild_id: "g1" },
    ]) {
      const res = await callAction(signedRequest(payload));
      const json = await res.json();
      expect(json.type).toBe(4);
      expect(json.data.flags).toBe(64);
    }
    expectNoBackendCalls();
  });

  it.each([
    ["non-allowlisted guild", command({ guild_id: "other" }), "g1", ""],
    ["DM without guild", command({ guild_id: undefined }), "g1", ""],
    ["empty guild allowlist", command(), "", ""],
    ["non-allowlisted user", command(), "g1", "u2, u3"],
  ])("refuses %s", async (_n, payload, guilds, users) => {
    process.env.DISCORD_ALLOWED_GUILD_IDS = guilds;
    process.env.DISCORD_ALLOWED_USER_IDS = users;
    const res = await callAction(signedRequest(payload));
    const json = await res.json();
    expect(json.type).toBe(4);
    expect(json.data.flags).toBe(64);
    expectNoBackendCalls();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("replies to an empty title without backend calls", async () => {
    const res = await callAction(
      signedRequest(command({ data: { name: "add-movie", options: [{ name: "title", value: "   " }] } })),
    );
    const json = await res.json();
    expect(json.data.content).toBe("Please provide a movie title.");
    expectNoBackendCalls();
  });

  it("defers, saves the first result, and PATCHes the final message", async () => {
    mocks.searchMovie.mockResolvedValue([tmdbResult, { ...tmdbResult, id: 43 }]);
    mocks.findMovieByTmdbId.mockResolvedValue(null);
    mocks.createMovie.mockResolvedValue({});

    const res = await callAction(signedRequest(command()));
    expect(await res.json()).toEqual({ type: 5 });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(mocks.searchMovie).toHaveBeenCalledWith("Dune");
    expect(mocks.findMovieByTmdbId).toHaveBeenCalledWith(42);
    expect(mocks.createMovie).toHaveBeenCalledWith({
      movieName: "Dune",
      releaseDate: "2021",
      selectedBy: "Display",
      categoryName: "",
      status: MovieStatus.UPCOMING,
      imageUrl: "https://img/x.jpg",
      tmdbId: 42,
    });
    expect(mocks.createMovie).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://discord.com/api/v10/webhooks/app1/secret-token/messages/@original",
    );
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({
      content: "Added **Dune (2021)** to Movie Vibes — picked by Display.",
    });
  });

  it("does not insert a duplicate tmdbId", async () => {
    mocks.searchMovie.mockResolvedValue([tmdbResult]);
    mocks.findMovieByTmdbId.mockResolvedValue({ id: "m1" });

    await callAction(signedRequest(command()));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(mocks.createMovie).not.toHaveBeenCalled();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).content).toBe(
      "This movie already exists.",
    );
  });

  it("reports no results without writing", async () => {
    mocks.searchMovie.mockResolvedValue([]);
    await callAction(signedRequest(command()));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(mocks.findMovieByTmdbId).not.toHaveBeenCalled();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).content).toBe(
      'Couldn\'t find a movie matching "Dune". Check the spelling, or pick from the suggestions that appear as you type.',
    );
  });

  it("sends a generic message on errors and survives a failing PATCH", async () => {
    mocks.searchMovie.mockRejectedValue(new Error("secret db detail"));
    await callAction(signedRequest(command()));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).content).toBe(
      "Something went wrong adding that movie. Please try again.",
    );

    fetchMock.mockRejectedValue(new Error("network secret-token"));
    await callAction(signedRequest(command()));
    await vi.waitFor(() => expect(console.error).toHaveBeenCalled());
    for (const call of vi.mocked(console.error).mock.calls) {
      expect(JSON.stringify(call)).not.toContain("secret-token");
    }
  });
});

describe("helpers", () => {
  it("parses id lists", () => {
    expect(parseIdList(" a, ,b ,,")).toEqual(["a", "b"]);
    expect(parseIdList(undefined)).toEqual([]);
  });

  it("allowlist rules", () => {
    const i = command() as never;
    expect(isInvocationAllowed(i, ["g1"], [])).toBe(true);
    expect(isInvocationAllowed(i, ["g1"], ["u1"])).toBe(true);
    expect(isInvocationAllowed(i, ["g1"], ["u2"])).toBe(false);
    expect(isInvocationAllowed(i, [], [])).toBe(false);
  });

  it("invoker name fallback chain", () => {
    expect(getInvokerName({ member: { user: { global_name: "G", username: "U" } } })).toBe("G");
    expect(getInvokerName({ member: { user: { global_name: null, username: "U" } } })).toBe("U");
    expect(getInvokerName({ user: { global_name: "G2", username: "U2" } })).toBe("G2");
    expect(getInvokerName({ user: { username: "U2" } })).toBe("U2");
    expect(getInvokerName({})).toBe("Discord");
  });

  it("maps save input with picked-by override and missing poster", () => {
    const i = command({
      data: {
        name: "add-movie",
        options: [
          { name: "title", value: "Dune" },
          { name: "picked-by", value: "  Sam  " },
        ],
      },
    }) as never;
    expect(buildSaveInput({ ...tmdbResult, poster_path: null }, i)).toEqual({
      movieName: "Dune",
      releaseDate: "2021",
      selectedBy: "Sam",
      categoryName: "",
      status: MovieStatus.UPCOMING,
      imageUrl: undefined,
      tmdbId: 42,
    });
    expect(buildSaveInput({ ...tmdbResult, release_date: "" }, i).releaseDate).toBe("");
  });

  it("omits the year when release_date is empty", () => {
    expect(buildSuccessMessage({ ...tmdbResult, release_date: "" }, "Sam")).toBe(
      "Added **Dune** to Movie Vibes — picked by Sam.",
    );
  });
});
