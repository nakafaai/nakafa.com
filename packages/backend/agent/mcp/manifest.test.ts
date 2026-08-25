import { fileURLToPath } from "node:url";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { Effect, FileSystem } from "effect";
import { describe, expect, it } from "vitest";
import { NAKAFA_MCP_SERVER_VERSION } from "./identity";
import { NAKAFA_MCP_REGISTRY_MANIFEST } from "./manifest";

const repositoryManifestUrl = new URL(
  "../../../../server.json",
  import.meta.url
);

describe("Nakafa MCP Registry manifest", () => {
  it("keeps the served manifest identical to repository server.json", async () => {
    const source = await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        return yield* fileSystem.readFileString(
          fileURLToPath(repositoryManifestUrl),
          "utf8"
        );
      }).pipe(Effect.provide(NodeFileSystem.layer))
    );

    expect(JSON.parse(source)).toEqual(NAKAFA_MCP_REGISTRY_MANIFEST);
    expect(NAKAFA_MCP_REGISTRY_MANIFEST).toMatchObject({
      $schema:
        "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
      name: "io.github.nakafaai/nakafa",
      remotes: [
        {
          type: "streamable-http",
          url: "https://mcp.nakafa.com/mcp",
        },
      ],
      version: NAKAFA_MCP_SERVER_VERSION,
    });
  });
});
