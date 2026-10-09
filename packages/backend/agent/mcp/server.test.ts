import { layer as nodeFileSystemLayer } from "@effect/platform-node/NodeFileSystem";
import { describe, expect, it } from "@effect/vitest";
import {
  NAKAFA_MCP_ENDPOINT,
  NAKAFA_MCP_SERVER_VERSION,
} from "@repo/contents/agent/constants";
import { Effect, FileSystem, Schema } from "effect";

/** The MCP Registry document that publishes this server, at the repository root. */
const REGISTRY_DOCUMENT = `${import.meta.dirname}/../../../../server.json`;

/** The registry fields that must name what the server itself reports. */
const RegistryDocument = Schema.fromJsonString(
  Schema.Struct({
    remotes: Schema.Array(
      Schema.Struct({ type: Schema.String, url: Schema.String })
    ),
    version: Schema.String,
  })
);

describe("Nakafa MCP Registry document", () => {
  it.effect("names the version and the endpoint that the server reports", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const document = yield* Schema.decodeEffect(RegistryDocument)(
        yield* fileSystem.readFileString(REGISTRY_DOCUMENT)
      );

      expect(document.version).toBe(NAKAFA_MCP_SERVER_VERSION);
      expect(document.remotes).toEqual([
        { type: "streamable-http", url: NAKAFA_MCP_ENDPOINT },
      ]);
    }).pipe(Effect.provide(nodeFileSystemLayer))
  );
});
