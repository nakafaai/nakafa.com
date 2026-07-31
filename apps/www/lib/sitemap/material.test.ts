// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  filterMaterialContentRows,
  filterMaterialPublicPaths,
} from "@/lib/sitemap/material";
import { previewProjection } from "@/test/content-preview";

const claimsMock = vi.hoisted(() => vi.fn());
const sourceMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-material");

vi.mock("@/lib/content/material/ownership", () => ({
  readPublishedMaterialClaims: claimsMock,
}));
vi.mock("@/lib/content/material/shell", () => ({
  readMaterialSource: sourceMock,
}));

beforeEach(() => {
  claimsMock.mockReset().mockReturnValue(Effect.succeed([]));
  sourceMock.mockReset().mockReturnValue({
    candidates: [],
    route: undefined,
  });
});

describe("material sitemap ownership", () => {
  it("removes only exact-owned source content rows", async () => {
    const owned = {
      kind: "curriculum-lesson",
      section: "material",
      sourceParentPath: previewProjection.parentPath,
      sourcePath: previewProjection.contentKey,
    };
    const topic = {
      kind: "curriculum-topic",
      section: "material",
      sourcePath: "material/lesson/mathematics/functions",
    };
    const tryout = {
      kind: "tryout-set",
      section: "tryout",
      sourcePath: "question-bank/tryout/indonesia/snbt/2027/set-1",
    };
    claimsMock.mockReturnValueOnce(
      Effect.succeed([
        {
          contentKey: previewProjection.contentKey,
          kind: "found",
          locale: "en",
          projection: previewProjection,
        },
      ])
    );

    await expect(
      Effect.runPromise(
        filterMaterialContentRows("en", [owned, topic, tryout], activeReleaseId)
      )
    ).resolves.toEqual([topic, tryout]);
    expect(claimsMock).toHaveBeenCalledWith(
      "en",
      [
        {
          contentKey: previewProjection.contentKey,
          locale: "en",
          parentPath: previewProjection.parentPath,
        },
      ],
      activeReleaseId
    );
  });

  it("removes only public paths whose source identity is exactly owned", async () => {
    const ownedPath = previewProjection.publicPath;
    const candidateOnlyPath = "subjects/mathematics/functions";
    const unmanagedPath = "subjects/physics/mechanics/motion";
    sourceMock.mockImplementation((_locale, path) => {
      if (path === ownedPath) {
        return {
          candidates: [
            {
              contentKey: previewProjection.contentKey,
              locale: "en",
              parentPath: previewProjection.parentPath,
            },
          ],
          route: {
            locale: "en",
            sourcePath: previewProjection.contentKey,
          },
        };
      }
      if (path === candidateOnlyPath) {
        return {
          candidates: [
            {
              contentKey: previewProjection.contentKey,
              locale: "en",
              parentPath: previewProjection.parentPath,
            },
          ],
          route: undefined,
        };
      }
      return {
        candidates: [],
        route: {
          locale: "en",
          sourcePath: "material/lesson/physics/mechanics/motion",
        },
      };
    });
    claimsMock.mockReturnValueOnce(
      Effect.succeed([
        {
          contentKey: previewProjection.contentKey,
          kind: "found",
          locale: "en",
          projection: previewProjection,
        },
      ])
    );

    await expect(
      Effect.runPromise(
        filterMaterialPublicPaths(
          "en",
          [ownedPath, candidateOnlyPath, unmanagedPath],
          activeReleaseId
        )
      )
    ).resolves.toEqual([candidateOnlyPath, unmanagedPath]);
    expect(claimsMock).toHaveBeenCalledWith(
      "en",
      [
        {
          contentKey: previewProjection.contentKey,
          locale: "en",
          parentPath: previewProjection.parentPath,
        },
      ],
      activeReleaseId
    );
  });
});
