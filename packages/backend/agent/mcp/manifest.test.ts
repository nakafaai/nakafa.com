import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { NAKAFA_MCP_REGISTRY_MANIFEST } from "./manifest";

const repositoryManifestUrl = new URL(
  "../../../../server.json",
  import.meta.url
);

describe("Nakafa MCP Registry manifest", () => {
  it("keeps the served manifest identical to repository server.json", async () => {
    const source = await readFile(repositoryManifestUrl, "utf8");

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
    });
  });
});
