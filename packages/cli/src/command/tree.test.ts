import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Ref, Result } from "effect";
import { TestConsole } from "effect/testing";
import { CliError, Command } from "effect/unstable/cli";
import { normalizeArgv } from "#cli/command/argv";
import type { CliRequest } from "#cli/command/spec";
import { makeCliCommand } from "#cli/command/tree";
import { InvocationError } from "#cli/error";

function readRequests(argv: readonly string[]) {
  return Effect.gen(function* () {
    const requests = yield* Ref.make<readonly CliRequest[]>([]);
    const command = makeCliCommand((request) =>
      Ref.update(requests, (current) => [...current, request])
    );
    const normalizedArgv = yield* normalizeArgv(argv);
    yield* Command.runWith(command, { version: "0.1.0" })(normalizedArgv);
    return yield* Ref.get(requests);
  }).pipe(Effect.provide(NodeServices.layer));
}

function readFailure(argv: readonly string[]) {
  return Effect.gen(function* () {
    const result = yield* readRequests(argv).pipe(Effect.result);
    return Result.isFailure(result) ? result.failure : undefined;
  });
}

describe("Nakafa CLI command tree", () => {
  it.effect("preserves operands after the option separator", () =>
    Effect.gen(function* () {
      expect(yield* readRequests(["search", "--", "--pretty"])).toMatchObject([
        {
          command: { kind: "search", query: "--pretty" },
          pretty: false,
        },
      ]);
    })
  );

  it.effect("resolves commands after the option separator", () =>
    Effect.gen(function* () {
      expect(
        yield* readRequests(["--", "search", "linear", "algebra"])
      ).toMatchObject([
        {
          command: { kind: "search", query: "linear algebra" },
          pretty: false,
        },
      ]);
      expect(yield* readRequests(["--pretty", "--", "taxonomy"])).toMatchObject(
        [
          {
            command: { kind: "taxonomy" },
            pretty: true,
          },
        ]
      );
    })
  );

  it.effect("moves command options behind their native subcommand", () =>
    Effect.gen(function* () {
      expect(yield* readRequests(["--locale", "id", "taxonomy"])).toMatchObject(
        [{ command: { kind: "taxonomy", locale: "id" } }]
      );
      expect(
        yield* readRequests(["--limit", "5", "search", "algebra"])
      ).toMatchObject([
        { command: { kind: "search", limit: 5, query: "algebra" } },
      ]);
    })
  );

  it.effect("renders native help and version without dispatching", () =>
    Effect.gen(function* () {
      expect(yield* readRequests(["--help"])).toEqual([]);
      expect(yield* readRequests(["--version"])).toEqual([]);

      const output = (yield* TestConsole.logLines).map(String).join("\n");
      expect(output).toContain("Nakafa CLI");
      expect(output).toContain("0.1.0");
    })
  );

  it.effect("parses search arguments and shared flags", () =>
    Effect.gen(function* () {
      expect(
        yield* readRequests([
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
          "--pretty",
          "--api-base",
          "https://isolated.example.com/",
        ])
      ).toEqual([
        {
          apiBase: "https://isolated.example.com",
          command: {
            kind: "search",
            limit: 10,
            locale: "de",
            offset: 9,
            query: "linear equations",
            section: "material",
          },
          pretty: true,
        },
      ]);
    })
  );

  it.effect.each([
    {
      argv: ["get", "content-id"],
      command: { kind: "get", ref: "content-id" },
    },
    {
      argv: ["taxonomy", "--locale", "id"],
      command: { kind: "taxonomy", locale: "id" },
    },
    { argv: ["taxonomy"], command: { kind: "taxonomy" } },
    { argv: ["mcp"], command: { kind: "mcp" } },
  ])("parses $argv", ({ argv, command }) =>
    Effect.gen(function* () {
      const [request] = yield* readRequests(argv);
      expect(request).toMatchObject({ command });
    })
  );

  it.effect("parses Quran range and tafsir options", () =>
    Effect.gen(function* () {
      const [request] = yield* readRequests([
        "quran",
        "2",
        "--from-verse",
        "255",
        "--to-verse",
        "257",
        "--locale",
        "en",
        "--tafsir",
      ]);
      expect(request).toMatchObject({
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

  it.effect("keeps operands after presence-only switches", () =>
    Effect.gen(function* () {
      expect(yield* readRequests(["quran", "--tafsir", "1"])).toMatchObject([
        {
          command: {
            includeTafsir: true,
            kind: "quran",
            surah: 1,
          },
        },
      ]);
      expect(yield* readRequests(["search", "--pretty", "true"])).toMatchObject(
        [
          {
            command: { kind: "search", query: "true" },
            pretty: true,
          },
        ]
      );
    })
  );

  it.effect("preserves operands after negated presence switches", () =>
    Effect.gen(function* () {
      expect(yield* readRequests(["quran", "--no-tafsir", "1"])).toMatchObject([
        {
          command: {
            includeTafsir: false,
            kind: "quran",
            surah: 1,
          },
        },
      ]);
      expect(
        yield* readRequests(["search", "--no-pretty", "true"])
      ).toMatchObject([
        {
          command: { kind: "search", query: "true" },
          pretty: false,
        },
      ]);
    })
  );

  it.effect.each([
    ["unknown"],
    ["search"],
    ["get"],
    ["get", "one", "two"],
    ["taxonomy", "extra"],
    ["mcp", "--locale", "en"],
    ["search", "query", "--limit", "11"],
    ["search", "query", "--limit", "zero"],
    ["search", "query", "--offset=-1"],
    ["search", "query", "--offset", "10"],
    ["search", "query", "--locale", "fr"],
    ["quran", "0"],
    ["quran", "115"],
    ["--api-base", "not-a-url", "taxonomy"],
    ["--api-base", "https://user@example.com", "taxonomy"],
    ["--api-base", "ftp://api.example.com", "taxonomy"],
    [
      "taxonomy",
      "--api-base",
      "https://first.example.com",
      "--api-base",
      "https://second.example.com",
    ],
    ["search", "query", "--locale", "en", "--locale", "de"],
    ["search", "query", "-p", "--pretty"],
    ["--unknown"],
  ])("rejects %j", (argv) =>
    Effect.gen(function* () {
      const error = yield* readFailure(argv);

      expect(CliError.isCliError(error)).toBe(true);
      expect(error?._tag).toBe("ShowHelp");
      if (error?._tag === "ShowHelp") {
        expect(error.errors.length).toBeGreaterThan(0);
      }
    })
  );

  it.effect.each([
    ["get", ""],
    ["get", "   "],
    ["search", ""],
    ["search", "   "],
  ])("rejects empty validated values for %j", (argv) =>
    Effect.gen(function* () {
      const error = yield* readFailure(argv);

      expect(error).toBeInstanceOf(InvocationError);
      expect(error?.message).toContain("Invalid command options");
    })
  );

  it.effect.each([
    ["mcp", "--pretty=false"],
    ["mcp", "-p=true"],
    ["quran", "--tafsir=false", "1"],
    ["quran", "--tafsir=true", "1"],
  ])("rejects explicit values for presence-only switches in %j", (argv) =>
    Effect.gen(function* () {
      const error = yield* readFailure(argv);

      expect(error).toBeInstanceOf(InvocationError);
      expect(error?.message).toContain("does not accept a value");
    })
  );
});
