// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { readPreviewRefreshHandler } from "@/lib/content/preview/refresh.server";

let previewConfigured = false;

vi.mock("@/lib/content/preview/config", () => ({
  hasPreviewConfig: () => previewConfigured,
}));

vi.mock("@/lib/content/preview/manifest", () => ({
  readPreviewManifestForPrerender: () =>
    Promise.resolve({ revision: 7, status: "ready" }),
}));

describe("readPreviewRefreshHandler", () => {
  it("answers nothing without a local preview, so no listener renders", async () => {
    previewConfigured = false;

    await expect(readPreviewRefreshHandler()).resolves.toBeUndefined();
  });

  it("answers the revision and status of the local preview", async () => {
    previewConfigured = true;

    await expect(readPreviewRefreshHandler()).resolves.toStrictEqual({
      revision: 7,
      status: "ready",
    });
  });
});
