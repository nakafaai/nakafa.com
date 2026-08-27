import { NAKAFA_MCP_PROTOCOL_VERSION } from "@repo/contents/_lib/agent/constants";
import { describe, expect, it, vi } from "@repo/testing/effect";
import { Effect } from "effect";
import type { FetchImplementation } from "./client.js";
import { runCli } from "./program.js";

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

function createOutput() {
  let value = "";
  return {
    read: () => value,
    stream: {
      write(chunk: string) {
        value += chunk;
      },
    },
  };
}

function execute(
  argv: readonly string[],
  fetchImplementation: FetchImplementation = async () =>
    Response.json({ ok: true })
) {
  const stdout = createOutput();
  const stderr = createOutput();
  return runCli(argv, {
    fetchImplementation,
    stderr: stderr.stream,
    stdout: stdout.stream,
    version: "0.1.0",
  }).pipe(
    Effect.map((exitCode) => ({
      exitCode,
      stderr: stderr.read(),
      stdout: stdout.read(),
    }))
  );
}

describe("Nakafa CLI execution", () => {
  it.live("prints help, version, and MCP metadata without network calls", () =>
    Effect.gen(function* () {
      const fetchImplementation = vi.fn<FetchImplementation>();
      const help = yield* execute(["--help"], fetchImplementation);
      const version = yield* execute(["--version"], fetchImplementation);
      const mcp = yield* execute(["mcp"], fetchImplementation);

      expect(help).toMatchObject({ exitCode: 0, stderr: "" });
      expect(help.stdout).toContain("Nakafa CLI");
      expect(version).toEqual({
        exitCode: 0,
        stderr: "",
        stdout: "0.1.0\n",
      });
      expect(JSON.parse(mcp.stdout)).toEqual({
        endpoint: "https://nakafa.com/mcp",
        manifest: "https://nakafa.com/mcp",
        protocol_version: NAKAFA_MCP_PROTOCOL_VERSION,
        transport: "streamable-http",
      });
      expect(fetchImplementation).not.toHaveBeenCalled();
    })
  );

  it.live.each([
    {
      argv: ["search", "linear", "equations", "--locale", "de", "--limit", "5"],
      expectedUrl:
        "https://api.nakafa.com/v1/search?query=linear+equations&locale=de&limit=5",
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
  ])("calls the public endpoint for $argv", ({ argv, expectedUrl }) =>
    Effect.gen(function* () {
      const fetchImplementation = vi.fn(async () =>
        Response.json({ ok: true })
      );

      const result = yield* execute(argv, fetchImplementation);

      expect(result).toEqual({
        exitCode: 0,
        stderr: "",
        stdout: '{"ok":true}\n',
      });
      expect(fetchImplementation).toHaveBeenCalledWith(
        expectedUrl,
        expect.any(Object)
      );
    })
  );

  it.live(
    "supports custom public API bases without forwarding edge secrets",
    () =>
      Effect.gen(function* () {
        const fetchImplementation = vi.fn<FetchImplementation>(async () =>
          Response.json({ nested: { ok: true } })
        );

        const result = yield* execute(
          [
            "taxonomy",
            "--pretty",
            "--api-base",
            "https://isolated.example.com",
          ],
          fetchImplementation
        );

        expect(result.stdout).toBe(
          '{\n  "nested": {\n    "ok": true\n  }\n}\n'
        );
        expect(fetchImplementation).toHaveBeenCalledWith(
          "https://isolated.example.com/v1/taxonomy",
          expect.any(Object)
        );
        const request = fetchImplementation.mock.calls[0]?.[1];
        expect([...new Headers(request?.headers)]).toEqual([
          ["accept", "application/json, application/problem+json"],
        ]);
      })
  );

  it.live(
    "returns stable invocation, API, server, network, and decoding exits",
    () =>
      Effect.gen(function* () {
        const invocation = yield* execute(["search"]);
        const api = yield* execute(["get", "missing"], async () =>
          Response.json(problem, { status: 404 })
        );
        const server = yield* execute(["taxonomy"], async () =>
          Response.json({ ...problem, status: 503 }, { status: 503 })
        );
        const network = yield* execute(["taxonomy"], () => {
          throw new Error("offline");
        });
        const decoding = yield* execute(
          ["taxonomy"],
          async () =>
            new Response("not JSON", {
              headers: { "content-type": "application/problem+json" },
              status: 502,
            })
        );
        const edge = yield* execute(
          ["taxonomy"],
          async () =>
            new Response("<html>rate limited</html>", {
              headers: {
                "content-type": "text/html",
                "retry-after": "30",
              },
              status: 429,
            })
        );
        const unavailableEdge = yield* execute(
          ["taxonomy"],
          async () => new Response("unavailable", { status: 503 })
        );

        expect(invocation.exitCode).toBe(2);
        expect(JSON.parse(invocation.stderr)).toMatchObject({
          code: "INVOCATION_ERROR",
        });
        expect(api.exitCode).toBe(3);
        expect(JSON.parse(api.stderr)).toEqual(problem);
        expect(server.exitCode).toBe(4);
        expect(JSON.parse(server.stderr)).toMatchObject({ status: 503 });
        expect(network.exitCode).toBe(4);
        expect(JSON.parse(network.stderr)).toMatchObject({
          code: "NETWORK_ERROR",
        });
        expect(decoding.exitCode).toBe(4);
        expect(JSON.parse(decoding.stderr)).toMatchObject({
          code: "INVALID_SERVER_RESPONSE",
          status: 502,
        });
        expect(edge.exitCode).toBe(3);
        expect(JSON.parse(edge.stderr)).toEqual({
          code: "HTTP_RESPONSE_ERROR",
          retry_after: "30",
          status: 429,
        });
        expect(unavailableEdge.exitCode).toBe(4);
        expect(JSON.parse(unavailableEdge.stderr)).toEqual({
          code: "HTTP_RESPONSE_ERROR",
          status: 503,
        });
      })
  );
});
