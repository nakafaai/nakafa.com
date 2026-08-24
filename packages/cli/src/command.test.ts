import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { HELP_TEXT, readCliRequest } from "./command.js";
import type { InvocationError } from "./error.js";

function readFailure(argv: readonly string[]) {
  return Effect.runPromise(
    readCliRequest(argv).pipe(
      Effect.match({
        onFailure: (error) => error,
        onSuccess: () => undefined,
      })
    )
  ) as Promise<InvocationError | undefined>;
}

describe("Nakafa CLI command parsing", () => {
  it("uses help for an empty invocation", async () => {
    await expect(Effect.runPromise(readCliRequest([]))).resolves.toEqual({
      apiBase: "https://api.nakafa.com",
      command: { kind: "help" },
      pretty: false,
    });
    expect(HELP_TEXT).toContain("nakafa search <query...>");
  });

  it("honors global help, version, pretty, and API base options", async () => {
    await expect(
      Effect.runPromise(
        readCliRequest([
          "search",
          "ignored",
          "--help",
          "--pretty",
          "--api-base",
          "https://isolated.example.com/",
        ])
      )
    ).resolves.toEqual({
      apiBase: "https://isolated.example.com",
      command: { kind: "help" },
      pretty: true,
    });
    await expect(
      Effect.runPromise(readCliRequest(["--version"]))
    ).resolves.toMatchObject({ command: { kind: "version" } });
  });

  it("parses search arguments and typed filters", async () => {
    await expect(
      Effect.runPromise(
        readCliRequest([
          "search",
          "linear",
          "equations",
          "--section",
          "material",
          "--locale",
          "de",
          "--limit",
          "25",
          "--offset",
          "49",
        ])
      )
    ).resolves.toEqual({
      apiBase: "https://api.nakafa.com",
      command: {
        kind: "search",
        limit: 25,
        locale: "de",
        offset: 49,
        query: "linear equations",
        section: "material",
      },
      pretty: false,
    });
  });

  it.each([
    [["get", "content-id"], { kind: "get", ref: "content-id" }],
    [["taxonomy", "--locale", "id"], { kind: "taxonomy", locale: "id" }],
    [["mcp"], { kind: "mcp" }],
  ])("parses %s", async (argv, command) => {
    await expect(
      Effect.runPromise(readCliRequest(argv))
    ).resolves.toMatchObject({ command });
  });

  it("parses Quran range and tafsir options", async () => {
    await expect(
      Effect.runPromise(
        readCliRequest([
          "quran",
          "2",
          "--from-verse",
          "255",
          "--to-verse",
          "257",
          "--locale",
          "en",
          "--tafsir",
        ])
      )
    ).resolves.toMatchObject({
      command: {
        fromVerse: 255,
        includeTafsir: true,
        kind: "quran",
        locale: "en",
        surah: 2,
        toVerse: 257,
      },
    });
  });

  it.each([
    [["unknown"], "Unknown command"],
    [["search"], "search requires a query"],
    [["get"], "get requires exactly one argument"],
    [["get", "one", "two"], "get requires exactly one argument"],
    [["taxonomy", "extra"], "taxonomy does not accept positional arguments"],
    [["mcp", "--locale", "en"], "--locale is not valid for mcp"],
    [["search", "query", "--limit", "51"], "Invalid command options"],
    [["search", "query", "--limit", "zero"], "Invalid command options"],
    [["search", "query", "--offset=-1"], "Invalid command options"],
    [["search", "query", "--offset", "50"], "Invalid command options"],
    [["search", "query", "--locale", "fr"], "Invalid command options"],
    [["quran", "0"], "Invalid command options"],
    [["quran", "115"], "Invalid command options"],
    [["--api-base", "not-a-url"], "Invalid command options"],
    [["--api-base", "https://user@example.com"], "Invalid command options"],
    [["--api-base", "ftp://api.example.com"], "Invalid command options"],
    [["--unknown"], "Unknown option"],
  ])("rejects %s", async (argv, message) => {
    const error = await readFailure(argv);

    expect(error?._tag).toBe("InvocationError");
    expect(error?.message).toContain(message);
  });
});
