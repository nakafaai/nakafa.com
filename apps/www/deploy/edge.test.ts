// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Record as Rec } from "effect";
import { edgeWorkerBindings } from "#www/deploy/edge";

describe("edgeWorkerBindings", () => {
  it("binds the origin, the release and the edge secret of the named Worker", () => {
    expect(Rec.keys(edgeWorkerBindings("NAKAFA_API_EDGE_SECRET"))).toEqual([
      "NAKAFA_CONVEX_SITE_URL",
      "NAKAFA_RELEASE_SHA",
      "NAKAFA_API_EDGE_SECRET",
    ]);
  });

  it("binds the MCP secret for the MCP Worker and never the API secret", () => {
    const bindings = edgeWorkerBindings("NAKAFA_MCP_EDGE_SECRET");

    expect(Rec.keys(bindings)).toContain("NAKAFA_MCP_EDGE_SECRET");
    expect(Rec.keys(bindings)).not.toContain("NAKAFA_API_EDGE_SECRET");
  });
});
