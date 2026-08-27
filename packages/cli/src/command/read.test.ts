import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readCliRequest } from "./read.js";
import { HELP_TEXT } from "./spec.js";

function readFailure(argv: readonly string[]) {
  return readCliRequest(argv).pipe(
    Effect.match({
      onFailure: (error) => error,
      onSuccess: () => undefined,
    })
  );
}

describe("Nakafa CLI command parsing", () => {
  it.live("uses help for an empty invocation", () =>
    Effect.gen(function* () {
      expect(yield* readCliRequest([])).toEqual({
        apiBase: "https://api.nakafa.com",
        command: { kind: "help" },
        pretty: false,
      });
      expect(HELP_TEXT).toContain("nakafa search <query...>");
    })
  );

  it.live("honors global help, version, pretty, and API base options", () =>
    Effect.gen(function* () {
      expect(
        yield* readCliRequest([
          "search",
          "ignored",
          "--help",
          "--pretty",
          "--api-base",
          "https://isolated.example.com/",
        ])
      ).toEqual({
        apiBase: "https://isolated.example.com",
        command: { kind: "help" },
        pretty: true,
      });
      expect(yield* readCliRequest(["--version"])).toMatchObject({
        command: { kind: "version" },
      });
    })
  );

  it.live("parses search arguments and typed filters", () =>
    Effect.gen(function* () {
      expect(
        yield* readCliRequest([
          "search",
          "linear",
          "equations",
          "--section",
          "material",
          "--locale",
          "de",
          "--limit",
          "10",
          "--offset",
          "9",
        ])
      ).toEqual({
        apiBase: "https://api.nakafa.com",
        command: {
          kind: "search",
          limit: 10,
          locale: "de",
          offset: 9,
          query: "linear equations",
          section: "material",
        },
        pretty: false,
      });
    })
  );

  it.live.each([
    {
      argv: ["get", "content-id"],
      command: { kind: "get", ref: "content-id" },
    },
    {
      argv: ["taxonomy", "--locale", "id"],
      command: { kind: "taxonomy", locale: "id" },
    },
    { argv: ["mcp"], command: { kind: "mcp" } },
  ])("parses $argv", ({ argv, command }) =>
    Effect.gen(function* () {
      expect(yield* readCliRequest(argv)).toMatchObject({ command });
    })
  );

  it.live("parses Quran range and tafsir options", () =>
    Effect.gen(function* () {
      expect(
        yield* readCliRequest([
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
      ).toMatchObject({
        command: {
          fromVerse: 255,
          includeTafsir: true,
          kind: "quran",
          locale: "en",
          surah: 2,
          toVerse: 257,
        },
      });
    })
  );

  it.live.each([
    { argv: ["unknown"], message: "Unknown command" },
    { argv: ["search"], message: "search requires a query" },
    { argv: ["get"], message: "get requires exactly one argument" },
    {
      argv: ["get", "one", "two"],
      message: "get requires exactly one argument",
    },
    {
      argv: ["taxonomy", "extra"],
      message: "taxonomy does not accept positional arguments",
    },
    {
      argv: ["mcp", "--locale", "en"],
      message: "--locale is not valid for mcp",
    },
    {
      argv: ["search", "query", "--limit", "11"],
      message: "Invalid command options",
    },
    {
      argv: ["search", "query", "--limit", "zero"],
      message: "Invalid command options",
    },
    {
      argv: ["search", "query", "--offset=-1"],
      message: "Invalid command options",
    },
    {
      argv: ["search", "query", "--offset", "10"],
      message: "Invalid command options",
    },
    {
      argv: ["search", "query", "--locale", "fr"],
      message: "Invalid command options",
    },
    { argv: ["quran", "0"], message: "Invalid command options" },
    { argv: ["quran", "115"], message: "Invalid command options" },
    { argv: ["--api-base", "not-a-url"], message: "Invalid command options" },
    {
      argv: ["--api-base", "https://user@example.com"],
      message: "Invalid command options",
    },
    {
      argv: ["--api-base", "ftp://api.example.com"],
      message: "Invalid command options",
    },
    { argv: ["--unknown"], message: "Unknown option" },
  ])("rejects $argv", ({ argv, message }) =>
    Effect.gen(function* () {
      const error = yield* readFailure(argv);

      expect(error?._tag).toBe("InvocationError");
      expect(error?.message).toContain(message);
    })
  );
});
