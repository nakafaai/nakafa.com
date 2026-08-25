import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
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

async function execute(
  argv: readonly string[],
  fetchImplementation: FetchImplementation = async () =>
    Response.json({ ok: true })
) {
  const stdout = createOutput();
  const stderr = createOutput();
  const exitCode = await Effect.runPromise(
    runCli(argv, {
      fetchImplementation,
      stderr: stderr.stream,
      stdout: stdout.stream,
      version: "0.1.0",
    })
  );
  return { exitCode, stderr: stderr.read(), stdout: stdout.read() };
}

describe("Nakafa CLI execution", () => {
  it("prints help, version, and MCP metadata without network calls", async () => {
    const fetchImplementation = vi.fn<FetchImplementation>();
    const help = await execute(["--help"], fetchImplementation);
    const version = await execute(["--version"], fetchImplementation);
    const mcp = await execute(["mcp"], fetchImplementation);

    expect(help).toMatchObject({ exitCode: 0, stderr: "" });
    expect(help.stdout).toContain("Nakafa CLI");
    expect(version).toEqual({ exitCode: 0, stderr: "", stdout: "0.1.0\n" });
    expect(JSON.parse(mcp.stdout)).toEqual({
      endpoint: "https://mcp.nakafa.com/mcp",
      manifest: "https://mcp.nakafa.com/mcp",
      protocol_version: "2026-07-28",
      transport: "streamable-http",
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it.each([
    [
      ["search", "linear", "equations", "--locale", "de", "--limit", "5"],
      "https://api.nakafa.com/v1/search?query=linear+equations&locale=de&limit=5",
    ],
    [
      ["get", "https://nakafa.com/en/content?id=1"],
      "https://api.nakafa.com/v1/content?ref=https%3A%2F%2Fnakafa.com%2Fen%2Fcontent%3Fid%3D1",
    ],
    [
      ["taxonomy", "--locale", "id"],
      "https://api.nakafa.com/v1/taxonomy?locale=id",
    ],
    [["taxonomy"], "https://api.nakafa.com/v1/taxonomy"],
    [
      [
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
      "https://api.nakafa.com/v1/quran/1?from_verse=1&to_verse=7&locale=en&include_tafsir=true",
    ],
    [["quran", "114"], "https://api.nakafa.com/v1/quran/114"],
  ])("calls the public endpoint for %s", async (argv, expectedUrl) => {
    const fetchImplementation = vi.fn(async () => Response.json({ ok: true }));

    const result = await execute(argv, fetchImplementation);

    expect(result).toEqual({
      exitCode: 0,
      stderr: "",
      stdout: '{"ok":true}\n',
    });
    expect(fetchImplementation).toHaveBeenCalledWith(
      expectedUrl,
      expect.any(Object)
    );
  });

  it("supports custom public API bases without forwarding edge secrets", async () => {
    const fetchImplementation = vi.fn<FetchImplementation>(async () =>
      Response.json({ nested: { ok: true } })
    );

    const result = await execute(
      ["taxonomy", "--pretty", "--api-base", "https://isolated.example.com"],
      fetchImplementation
    );

    expect(result.stdout).toBe('{\n  "nested": {\n    "ok": true\n  }\n}\n');
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://isolated.example.com/v1/taxonomy",
      expect.any(Object)
    );
    const request = fetchImplementation.mock.calls[0]?.[1];
    expect([...new Headers(request?.headers)]).toEqual([
      ["accept", "application/json, application/problem+json"],
    ]);
  });

  it("returns stable invocation, API, server, network, and decoding exits", async () => {
    const invocation = await execute(["search"]);
    const api = await execute(["get", "missing"], async () =>
      Response.json(problem, { status: 404 })
    );
    const server = await execute(["taxonomy"], async () =>
      Response.json({ ...problem, status: 503 }, { status: 503 })
    );
    const network = await execute(["taxonomy"], () => {
      throw new Error("offline");
    });
    const decoding = await execute(
      ["taxonomy"],
      async () => new Response("not JSON", { status: 502 })
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
    expect(JSON.parse(network.stderr)).toMatchObject({ code: "NETWORK_ERROR" });
    expect(decoding.exitCode).toBe(4);
    expect(JSON.parse(decoding.stderr)).toMatchObject({
      code: "INVALID_SERVER_RESPONSE",
      status: 502,
    });
  });
});
