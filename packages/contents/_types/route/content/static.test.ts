import { listPublicContentRoutes } from "@repo/contents/_types/route/content";
import { readStaticPublicContentRoutes } from "@repo/contents/_types/route/content/static";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("readStaticPublicContentRoutes", () => {
  it("matches the validated default projection", () => {
    expect(readStaticPublicContentRoutes()).toEqual(
      Effect.runSync(listPublicContentRoutes())
    );
  });
});
