import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  pickRandomUpcomingPicker: vi.fn(),
  dbMovie: { findMany: vi.fn() },
}));

vi.mock("~/models/movie.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/models/movie.server")>();
  return {
    ...actual,
    pickRandomUpcomingPicker: mocks.pickRandomUpcomingPicker,
  };
});
vi.mock("~/db.server", () => ({ default: { movie: mocks.dbMovie } }));
vi.mock("../services/tmdb", () => ({
  searchMovie: vi.fn(),
  searchMovieById: vi.fn(),
}));

import { action } from "../app/routes/api.discord.interactions";
import { commands, spinCommand } from "../app/utils/discord-commands";
import {
  MSG_NOT_AVAILABLE,
  MSG_NO_UPCOMING_PICKERS,
  MSG_SPIN_ERROR,
  buildSpinMessage,
} from "../app/utils/discord.server";
import { uniquePickerNames } from "../app/utils/pickers";
import { MovieStatus } from "~/lib/generated/prisma/enums";

// The real model function, bypassing the route's mock.
const { pickRandomUpcomingPicker: realPick } = await vi.importActual<
  typeof import("~/models/movie.server")
>("~/models/movie.server");

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUBLIC_HEX = publicKey
  .export({ format: "der", type: "spki" })
  .subarray(-32)
  .toString("hex");

const BASE = "https://discord.com/api/v10/webhooks/app123/tok";
const ORIGINAL = `${BASE}/messages/@original`;

async function run(interaction: unknown) {
  const body = JSON.stringify(interaction);
  const ts = "1700000000";
  const request = new Request("http://localhost/api/discord/interactions", {
    method: "POST",
    headers: {
      "X-Signature-Timestamp": ts,
      "X-Signature-Ed25519": sign(
        null,
        Buffer.from(ts + body),
        privateKey,
      ).toString("hex"),
    },
    body,
  });
  return (await action({ request, params: {}, context: {} } as never)) as Response;
}

function spin(type = 2, extra: Record<string, unknown> = {}) {
  return {
    type,
    token: "tok",
    guild_id: "g1",
    member: { user: { id: "u1", username: "uname" } },
    data: { name: "spin" },
    ...extra,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

function calls() {
  return fetchMock.mock.calls.map(([url, init]) => {
    const i = init as RequestInit;
    return {
      url: String(url),
      method: i.method,
      body: typeof i.body === "string" ? JSON.parse(i.body) : undefined,
    };
  });
}

beforeEach(() => {
  process.env.DISCORD_PUBLIC_KEY = PUBLIC_HEX;
  process.env.DISCORD_APPLICATION_ID = "app123";
  process.env.DISCORD_ALLOWED_GUILD_IDS = "g1";
  process.env.DISCORD_ALLOWED_USER_IDS = "";
  mocks.pickRandomUpcomingPicker.mockReset().mockResolvedValue("Dennis");
  mocks.dbMovie.findMany.mockReset();
  fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("spinCommand definition", () => {
  it("has no options, matches the other commands' contexts, and is registered", () => {
    expect(spinCommand.name).toBe("spin");
    expect(spinCommand.description).toBeTruthy();
    expect(spinCommand.integration_types).toEqual([0, 1]);
    expect(spinCommand.contexts).toEqual([0, 1, 2]);
    expect(spinCommand).not.toHaveProperty("options");
    expect(commands).toContain(spinCommand);
  });

  it("is listed in the registration script header", () => {
    const script = readFileSync("scripts/register-discord-commands.ts", "utf8");
    expect(script.split("*/")[0]).toContain("/spin");
  });
});

describe("/spin route", () => {
  it("defers publicly, then PATCHes @original with the winner and no mentions", async () => {
    const res = await run(spin());
    expect(await res.json()).toEqual({ type: 5 });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(calls()).toEqual([
      {
        url: ORIGINAL,
        method: "PATCH",
        body: {
          content: "🎡 The wheel has spoken: **Dennis** is picking tonight!",
          allowed_mentions: { parse: [] },
        },
      },
    ]);
  });

  it("does not let a name ping the channel", async () => {
    mocks.pickRandomUpcomingPicker.mockResolvedValue("@everyone");
    await run(spin());
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(calls()[0].body).toEqual({
      content: buildSpinMessage("@everyone"),
      allowed_mentions: { parse: [] },
    });
  });

  it("with nobody upcoming: DELETE @original, then an ephemeral hint", async () => {
    mocks.pickRandomUpcomingPicker.mockResolvedValue(undefined);
    await run(spin());
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(calls()).toEqual([
      { url: ORIGINAL, method: "DELETE", body: undefined },
      {
        url: BASE,
        method: "POST",
        body: {
          content: MSG_NO_UPCOMING_PICKERS,
          flags: 64,
          allowed_mentions: { parse: [] },
        },
      },
    ]);
  });

  it("on a DB error: ephemeral generic error, logs only the message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.pickRandomUpcomingPicker.mockRejectedValue(new Error("db down"));
    await run(spin());
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(calls()[1].body).toEqual({
      content: MSG_SPIN_ERROR,
      flags: 64,
      allowed_mentions: { parse: [] },
    });
    expect(log).toHaveBeenCalledWith("Discord spin failed:", "db down");
    expect(JSON.stringify(log.mock.calls)).not.toContain("tok");
  });

  it("refuses outside the allowlist without touching data", async () => {
    process.env.DISCORD_ALLOWED_GUILD_IDS = "other";
    const res = await run(spin());
    expect(await res.json()).toEqual({
      type: 4,
      data: { content: MSG_NOT_AVAILABLE, flags: 64 },
    });
    expect(mocks.pickRandomUpcomingPicker).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns no autocomplete suggestions", async () => {
    const res = await run(spin(4));
    expect(await res.json()).toEqual({ type: 8, data: { choices: [] } });
    expect(mocks.pickRandomUpcomingPicker).not.toHaveBeenCalled();
  });

  it("rejects a bad signature", async () => {
    const res = await action({
      request: new Request("http://localhost/api/discord/interactions", {
        method: "POST",
        headers: {
          "X-Signature-Timestamp": "1",
          "X-Signature-Ed25519": "00".repeat(64),
        },
        body: JSON.stringify(spin()),
      }),
      params: {},
      context: {},
    } as never);
    expect((res as Response).status).toBe(401);
    expect(mocks.pickRandomUpcomingPicker).not.toHaveBeenCalled();
  });
});

describe("uniquePickerNames (shared with the home-page wheel)", () => {
  it("dedupes by exact string and drops blank names, keeping first-seen order", () => {
    expect(
      uniquePickerNames(["Ana", "Bo", "Ana", "", "   ", null, undefined, "ana", "Bo "]),
    ).toEqual(["Ana", "Bo", "ana", "Bo "]);
  });
});

describe("pickRandomUpcomingPicker (real model)", () => {
  const rows = [
    { selectedBy: "Ana" },
    { selectedBy: "Bo" },
    { selectedBy: "Ana" },
    { selectedBy: "  " },
    { selectedBy: "Cy" },
  ];

  // db.movie only exposes findMany here, so any write would throw.
  it("queries UPCOMING movies only, read-only", async () => {
    mocks.dbMovie.findMany.mockResolvedValue(rows);
    await realPick();
    expect(mocks.dbMovie.findMany).toHaveBeenCalledWith({
      where: { status: MovieStatus.UPCOMING },
      select: { selectedBy: true },
    });
  });

  it.each([
    [0, "Ana"],
    [0.5, "Bo"],
    [0.9999999, "Cy"],
  ])("Math.random()=%s picks %s, unweighted and always in range", async (r, name) => {
    mocks.dbMovie.findMany.mockResolvedValue(rows);
    vi.spyOn(Math, "random").mockReturnValue(r);
    expect(await realPick()).toBe(name);
  });

  it("returns the only name when there is one picker", async () => {
    mocks.dbMovie.findMany.mockResolvedValue([{ selectedBy: "Solo" }, { selectedBy: "Solo" }]);
    expect(await realPick()).toBe("Solo");
  });

  it.each([[[]], [[{ selectedBy: "" }, { selectedBy: " " }]]])(
    "returns undefined when nobody qualifies (%j)",
    async (r) => {
      mocks.dbMovie.findMany.mockResolvedValue(r);
      expect(await realPick()).toBeUndefined();
    },
  );
});
