import { captureServerException } from "@repo/analytics/posthog/server";
import {
  type ContentModule,
  importContentModule,
} from "@repo/contents/_lib/module";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { importContentModuleOrNull } from "@/lib/content/module";

vi.mock("@repo/contents/_lib/module", () => ({
  importContentModule: vi.fn(),
}));

vi.mock("@repo/analytics/posthog/server", () => ({
  captureServerException: vi.fn(),
}));

/** Synthetic MDX component used by the content module import tests. */
function TestContent() {
  return null;
}

describe("importContentModuleOrNull", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the imported content module", async () => {
    const content = {
      default: TestContent,
    } satisfies ContentModule;

    vi.mocked(importContentModule).mockResolvedValue(content);

    await expect(
      importContentModuleOrNull({
        filePath: "/articles/politics/example",
        locale: "id",
        source: "article-content-module",
      })
    ).resolves.toBe(content);
  });

  it("reports failed imports and returns null for request-time notFound handling", async () => {
    const cause = new Error("missing compiled module");

    vi.mocked(importContentModule).mockRejectedValue(cause);

    await expect(
      importContentModuleOrNull({
        context: { route: "/articles/politics/example" },
        filePath: "/articles/politics/example",
        locale: "id",
        source: "article-content-module",
      })
    ).resolves.toBeNull();

    expect(captureServerException).toHaveBeenCalledWith(
      cause,
      undefined,
      expect.objectContaining({
        file_path: "/articles/politics/example",
        locale: "id",
        route: "/articles/politics/example",
        source: "article-content-module",
      })
    );
  });

  it("still returns null when import failure reporting is unavailable", async () => {
    const cause = new Error("missing compiled module");

    vi.mocked(importContentModule).mockRejectedValue(cause);
    vi.mocked(captureServerException).mockRejectedValue(
      new Error("analytics unavailable")
    );

    await expect(
      importContentModuleOrNull({
        filePath: "/material/lesson/math/functions",
        locale: "id",
        source: "subject-content-module",
      })
    ).resolves.toBeNull();

    expect(captureServerException).toHaveBeenCalledWith(
      cause,
      undefined,
      expect.objectContaining({
        file_path: "/material/lesson/math/functions",
        locale: "id",
        source: "subject-content-module",
      })
    );
  });
});
