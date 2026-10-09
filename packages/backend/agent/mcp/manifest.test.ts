import { fileURLToPath } from "node:url";
import { layer as nodeFileSystemLayer } from "@effect/platform-node/NodeFileSystem";
import { describe, expect, it } from "@effect/vitest";
import { NAKAFA_MCP_REGISTRY_MANIFEST } from "@repo/backend/agent/mcp/manifest";
import { NAKAFA_MCP_SERVER_VERSION } from "@repo/contents/agent/constants";
import { JsonTextSchema } from "@repo/utilities/json";
import { Effect, FileSystem, Schema } from "effect";

const repositoryManifestUrl = new URL(
  "../../../../server.json",
  import.meta.url
);

describe("Nakafa MCP Registry manifest", () => {
  it.effect("matches the repository Registry document exactly", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const source = yield* fileSystem.readFileString(
        fileURLToPath(repositoryManifestUrl),
        "utf8"
      );

      const manifest = yield* Schema.decodeEffect(JsonTextSchema)(source);

      expect(manifest).toEqual(NAKAFA_MCP_REGISTRY_MANIFEST);
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
    }).pipe(Effect.provide(nodeFileSystemLayer))
  );
});
