import { describe, expect, it } from "@effect/vitest";
import { NAKAFA_MCP_PROTOCOL_VERSION } from "@repo/contents/_lib/agent/constants";
import {
  Effect,
  FileSystem,
  Layer,
  Path,
  Ref,
  Schema,
  Sink,
  Stdio,
  Terminal,
} from "effect";
import { TestConsole } from "effect/testing";
import {
  HttpClient,
  HttpClientError,
  type HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { ChildProcessSpawner } from "effect/unstable/process";
import { runCli } from "#cli/program";

const problem = {
  code: "NOT_FOUND",
  detail: "The requested content does not exist.",
  instance: "/v1/content",
  request_id: "request-123",
  resolution: "Use a content ID returned by search.",
  status: 404,
  title: "Not found",
  type: "https://nakafa.com/problems/not-found",
};

const decodeJson = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Json)
);

const cliPlatformLayer = Layer.mergeAll(
  FileSystem.layerNoop({}),
  Path.layer,
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(80),
      display: () => Effect.void,
      readInput: Effect.die("Unexpected terminal input"),
      readLine: Effect.die("Unexpected terminal input"),
      rows: Effect.succeed(24),
    })
  ),
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.die("Unexpected child process"))
  )
);

function makeClient(
  makeResponse: (request: HttpClientRequest.HttpClientRequest) => Response
) {
  return HttpClient.make((request) =>
    Effect.sync(() =>
      HttpClientResponse.fromWeb(request, makeResponse(request))
    )
  );
}

function execute(
  argv: readonly string[],
  client: HttpClient.HttpClient = makeClient(() => Response.json({ ok: true }))
) {
  return Effect.gen(function* () {
    const consoleBefore = yield* TestConsole.logLines;
    const stderr = yield* Ref.make("");
    const stdout = yield* Ref.make("");
    const append = (target: Ref.Ref<string>) =>
      Sink.forEachWhile((chunk: string | Uint8Array) =>
        Ref.update(
          target,
          (current) =>
            current +
            (typeof chunk === "string"
              ? chunk
              : new TextDecoder().decode(chunk))
        ).pipe(Effect.as(true))
      );
    const layer = Layer.mergeAll(
      cliPlatformLayer,
      Layer.succeed(HttpClient.HttpClient, client),
      Stdio.layerTest({
        stderr: () => append(stderr),
        stdout: () => append(stdout),
      })
    );
    const exitCode = yield* runCli(argv, { version: "0.1.0" }).pipe(
      Effect.provide(layer)
    );
    const consoleAfter = yield* TestConsole.logLines;
    const consoleOutput = consoleAfter
      .slice(consoleBefore.length)
      .map(String)
      .join("\n");
    const capturedStdout = yield* Ref.get(stdout);
    return {
      exitCode,
      stderr: yield* Ref.get(stderr),
      stdout:
        consoleOutput.length === 0
          ? capturedStdout
          : `${capturedStdout}${consoleOutput}\n`,
    };
  });
}

describe("Nakafa CLI execution", () => {
  it.effect(
    "prints help, version, and MCP metadata without network calls",
    () =>
      Effect.gen(function* () {
        const client = HttpClient.make(() => Effect.die("unexpected request"));
        const empty = yield* execute([], client);
        const help = yield* execute(["--help"], client);
        const sharedOptionHelp = yield* execute(["--pretty"], client);
        const sharedValueHelp = yield* execute(
          ["--api-base", "https://isolated.example.com"],
          client
        );
        const commandOptionHelp = yield* Effect.forEach(
          [
            ["--locale", "id"],
            ["--limit", "5"],
            ["--tafsir"],
            ["--locale", "id", "--"],
            ["--limit", "5", "--"],
            ["--tafsir", "--"],
          ],
          (argv) => execute(argv, client)
        );
        const commandHelp = yield* execute(["taxonomy", "--help"], client);
        const crossCommandHelp = yield* execute(
          ["taxonomy", "--limit", "5", "--help"],
          client
        );
        const crossCommandVersion = yield* execute(
          ["mcp", "--locale", "en", "--version"],
          client
        );
        const version = yield* execute(["--version"], client);
        const mcp = yield* execute(["mcp"], client);

        expect(empty).toMatchObject({ exitCode: 0, stderr: "" });
        expect(empty.stdout).toContain("Nakafa CLI");
        expect(help).toMatchObject({ exitCode: 0, stderr: "" });
        expect(help.stdout).toContain("Nakafa CLI");
        expect(sharedOptionHelp).toMatchObject({ exitCode: 0, stderr: "" });
        expect(sharedOptionHelp.stdout).toContain("Nakafa CLI");
        expect(sharedValueHelp).toMatchObject({ exitCode: 0, stderr: "" });
        expect(sharedValueHelp.stdout).toContain("Nakafa CLI");
        for (const result of commandOptionHelp) {
          expect(result).toMatchObject({ exitCode: 0, stderr: "" });
          expect(result.stdout).toContain("Nakafa CLI");
        }
        expect(commandHelp).toMatchObject({ exitCode: 0, stderr: "" });
        expect(commandHelp.stdout).toContain("published content taxonomy");
        expect(crossCommandHelp).toMatchObject({ exitCode: 0, stderr: "" });
        expect(crossCommandHelp.stdout).toContain("published content taxonomy");
        expect(crossCommandVersion).toEqual({
          exitCode: 0,
          stderr: "",
          stdout: "0.1.0\n",
        });
        expect(version).toEqual({
          exitCode: 0,
          stderr: "",
          stdout: "0.1.0\n",
        });
        expect(yield* decodeJson(mcp.stdout)).toEqual({
          endpoint: "https://nakafa.com/mcp",
          protocol_version: NAKAFA_MCP_PROTOCOL_VERSION,
          transport: "streamable-http",
        });
      })
  );

  it.effect("renders action help before positional validation", () =>
    Effect.gen(function* () {
      const client = HttpClient.make(() => Effect.die("unexpected request"));
      const results = yield* Effect.forEach(
        [
          ["search", "--help"],
          ["get", "--help"],
          ["quran", "--help"],
          ["taxonomy", "-h-foo"],
          ["--help", "--", "--"],
        ],
        (argv) => execute(argv, client)
      );

      for (const result of results) {
        expect(result).toMatchObject({ exitCode: 0, stderr: "" });
        expect(result.stdout).not.toBe("");
      }
    })
  );

  it.effect.each([
    {
      argv: ["search", "linear", "equations", "--locale", "de", "--limit", "5"],
      expectedUrl:
        "https://api.nakafa.com/v1/search?query=linear+equations&locale=de&limit=5",
    },
    {
      argv: ["--", "search", "linear", "equations"],
      expectedUrl: "https://api.nakafa.com/v1/search?query=linear+equations",
    },
    {
      argv: ["--limit", "5", "search", "algebra"],
      expectedUrl: "https://api.nakafa.com/v1/search?query=algebra&limit=5",
    },
    {
      argv: ["get", "https://nakafa.com/en/content?id=1"],
      expectedUrl:
        "https://api.nakafa.com/v1/content?ref=https%3A%2F%2Fnakafa.com%2Fen%2Fcontent%3Fid%3D1",
    },
    {
      argv: ["taxonomy", "--locale", "id"],
      expectedUrl: "https://api.nakafa.com/v1/taxonomy?locale=id",
    },
    {
      argv: ["--locale", "id", "taxonomy"],
      expectedUrl: "https://api.nakafa.com/v1/taxonomy?locale=id",
    },
    {
      argv: ["taxonomy"],
      expectedUrl: "https://api.nakafa.com/v1/taxonomy",
    },
    {
      argv: [
        "quran",
        "1",
        "--from-verse",
        "1",
        "--to-verse",
        "7",
        "--locale",
        "en",
        "--tafsir",
      ],
      expectedUrl:
        "https://api.nakafa.com/v1/quran/1?from_verse=1&to_verse=7&locale=en&include_tafsir=true",
    },
    {
      argv: ["quran", "114"],
      expectedUrl: "https://api.nakafa.com/v1/quran/114",
    },
    {
      argv: ["quran", "--no-tafsir", "1"],
      expectedUrl: "https://api.nakafa.com/v1/quran/1",
    },
    {
      argv: ["search", "--no-pretty", "true"],
      expectedUrl: "https://api.nakafa.com/v1/search?query=true",
    },
    {
      argv: ["--no-help", "taxonomy"],
      expectedUrl: "https://api.nakafa.com/v1/taxonomy",
    },
    {
      argv: ["taxonomy", "--no-version"],
      expectedUrl: "https://api.nakafa.com/v1/taxonomy",
    },
  ])("calls the public endpoint for $argv", ({ argv, expectedUrl }) =>
    Effect.gen(function* () {
      const requests = yield* Ref.make<
        readonly HttpClientRequest.HttpClientRequest[]
      >([]);
      const client = HttpClient.make((request) =>
        Ref.update(requests, (current) => [...current, request]).pipe(
          Effect.as(
            HttpClientResponse.fromWeb(request, Response.json({ ok: true }))
          )
        )
      );

      const result = yield* execute(argv, client);

      expect(result).toEqual({
        exitCode: 0,
        stderr: "",
        stdout: '{"ok":true}\n',
      });
      expect((yield* Ref.get(requests)).map(({ url }) => url)).toEqual([
        expectedUrl,
      ]);
    })
  );

  it.effect(
    "supports custom public API bases without forwarding edge secrets",
    () =>
      Effect.gen(function* () {
        const requests = yield* Ref.make<
          readonly HttpClientRequest.HttpClientRequest[]
        >([]);
        const client = HttpClient.make((request) =>
          Ref.update(requests, (current) => [...current, request]).pipe(
            Effect.as(
              HttpClientResponse.fromWeb(
                request,
                Response.json({ nested: { ok: true } })
              )
            )
          )
        );

        const result = yield* execute(
          [
            "taxonomy",
            "--pretty",
            "--api-base",
            "https://isolated.example.com",
          ],
          client
        );

        expect(result.stdout).toBe(
          '{\n  "nested": {\n    "ok": true\n  }\n}\n'
        );
        const [request] = yield* Ref.get(requests);
        expect(request?.url).toBe("https://isolated.example.com/v1/taxonomy");
        expect(request?.headers.accept).toBe(
          "application/json, application/problem+json"
        );
        expect(request?.headers.authorization).toBeUndefined();
        expect(request?.headers.cookie).toBeUndefined();
      })
  );

  it.effect(
    "returns stable invocation, API, server, network, and decoding exits",
    () =>
      Effect.gen(function* () {
        const invocation = yield* execute(["search"]);
        const explicitSwitch = yield* execute(["mcp", "--pretty=false"]);
        const unknown = yield* execute(["unknown"]);
        const emptyRef = yield* execute(["get", ""]);
        const emptyQuery = yield* execute(["search", ""]);
        const api = yield* execute(
          ["get", "missing"],
          makeClient(() => Response.json(problem, { status: 404 }))
        );
        const server = yield* execute(
          ["taxonomy"],
          makeClient(() =>
            Response.json({ ...problem, status: 503 }, { status: 503 })
          )
        );
        const network = yield* execute(
          ["taxonomy"],
          HttpClient.make((request) =>
            Effect.fail(
              new HttpClientError.HttpClientError({
                reason: new HttpClientError.TransportError({
                  cause: new Error("offline"),
                  request,
                }),
              })
            )
          )
        );
        const decoding = yield* execute(
          ["taxonomy"],
          makeClient(
            () =>
              new Response("not JSON", {
                headers: { "content-type": "application/problem+json" },
                status: 502,
              })
          )
        );
        const edge = yield* execute(
          ["taxonomy"],
          makeClient(
            () =>
              new Response("<html>rate limited</html>", {
                headers: {
                  "content-type": "text/html",
                  "retry-after": "30",
                },
                status: 429,
              })
          )
        );
        const unavailableEdge = yield* execute(
          ["taxonomy"],
          makeClient(() => new Response("unavailable", { status: 503 }))
        );

        expect(invocation.exitCode).toBe(2);
        expect(invocation.stdout).toBe("");
        expect(yield* decodeJson(invocation.stderr)).toMatchObject({
          code: "INVOCATION_ERROR",
        });
        expect(explicitSwitch).toMatchObject({ exitCode: 2, stdout: "" });
        expect(yield* decodeJson(explicitSwitch.stderr)).toMatchObject({
          code: "INVOCATION_ERROR",
        });
        expect(unknown).toMatchObject({ exitCode: 2, stdout: "" });
        expect(yield* decodeJson(unknown.stderr)).toMatchObject({
          code: "INVOCATION_ERROR",
        });
        expect(emptyRef).toMatchObject({ exitCode: 2, stdout: "" });
        expect(yield* decodeJson(emptyRef.stderr)).toMatchObject({
          code: "INVOCATION_ERROR",
        });
        expect(emptyQuery).toMatchObject({ exitCode: 2, stdout: "" });
        expect(yield* decodeJson(emptyQuery.stderr)).toMatchObject({
          code: "INVOCATION_ERROR",
        });
        expect(api.exitCode).toBe(3);
        expect(yield* decodeJson(api.stderr)).toEqual(problem);
        expect(server.exitCode).toBe(4);
        expect(yield* decodeJson(server.stderr)).toMatchObject({ status: 503 });
        expect(network.exitCode).toBe(4);
        expect(yield* decodeJson(network.stderr)).toMatchObject({
          code: "NETWORK_ERROR",
        });
        expect(decoding.exitCode).toBe(4);
        expect(yield* decodeJson(decoding.stderr)).toMatchObject({
          code: "INVALID_SERVER_RESPONSE",
          status: 502,
        });
        expect(edge.exitCode).toBe(3);
        expect(yield* decodeJson(edge.stderr)).toEqual({
          code: "HTTP_RESPONSE_ERROR",
          retry_after: "30",
          status: 429,
        });
        expect(unavailableEdge.exitCode).toBe(4);
        expect(yield* decodeJson(unavailableEdge.stderr)).toEqual({
          code: "HTTP_RESPONSE_ERROR",
          status: 503,
        });
      })
  );

  it.effect.each([
    ["taxonomy", "--bogus", "--help"],
    ["--version", "--unknown"],
    ["search", "query", "--limit", "zero", "--help"],
    ["taxonomy", "--locale", "--help", "id"],
    ["taxonomy", "-xh"],
    ["taxonomy", "--locale", "-xh"],
    ["taxonomy", "-p-hfoo"],
    ["taxonomy", "-x-hfoo"],
    ["taxonomy", "-xh-foo"],
    ["--h"],
    ["--v"],
    ["--p", "taxonomy"],
    ["search", "", "--help"],
    ["get", "", "--help"],
  ])("rejects invalid action invocation %j", (argv) =>
    Effect.gen(function* () {
      const result = yield* execute(argv);

      expect(result).toMatchObject({ exitCode: 2, stdout: "" });
      expect(yield* decodeJson(result.stderr)).toMatchObject({
        code: "INVOCATION_ERROR",
      });
    })
  );
});
