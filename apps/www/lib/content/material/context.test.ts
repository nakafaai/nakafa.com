// @vitest-environment node

import {
  PublicPathSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import type { CurriculumRoute } from "@nakafa/aksara-contracts/program/curriculum";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublishedMaterialContext,
  readPublishedMaterialContext,
} from "@/lib/content/material/context";
import { previewProjection } from "@/test/content-preview";
import {
  testCurriculumRowJson,
  testProgramContexts,
  testProgramGroups,
  testProgramSubject,
} from "@/test/content-program";

const fetchMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
const group = testProgramGroups[0];
if (!group) {
  throw new Error("Expected the real Function Concept curriculum group.");
}
const context = {
  nodeKey: group.nodeKey,
  programKey: group.programKey,
};
const mapping = testProgramContexts.find(
  (route) => route.materialContextNodeKey === group.nodeKey
);
if (!mapping) {
  throw new Error("Expected the real Function Concept curriculum mapping.");
}
const publishedContext = {
  groupJson: testCurriculumRowJson(group),
  managed: true,
  mappingJson: testCurriculumRowJson(mapping),
  parentJson: testCurriculumRowJson(testProgramSubject),
  resolvedCanonicalPath: mapping.canonicalPath ?? null,
};

vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: cacheMock,
}));
vi.mock("@/lib/content/runtime/query", async () => {
  const { readTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    fetchRuntimeQuery: fetchMock,
    readRuntimeQuery: readTestRuntimeQuery,
  };
});

beforeEach(() => {
  fetchMock.mockReset();
  cacheMock.mockReset();
});

describe("published material context", () => {
  it("builds a return link from verified curriculum rows", async () => {
    fetchMock.mockResolvedValueOnce(publishedContext);

    await expect(
      getPublishedMaterialContext("en", previewProjection, context)
    ).resolves.toMatchObject({
      managed: true,
      value: {
        context,
        group: {
          nodeKey: group.nodeKey,
          publicPath: group.publicPath,
        },
        href: expect.stringContaining(
          "/en/curriculum/merdeka/class-11/mathematics#"
        ),
        label: "Function Composition and Inverses",
        mapping: {
          canonicalPath: mapping.canonicalPath,
        },
        parent: {
          nodeKey: testProgramSubject.nodeKey,
          publicPath: testProgramSubject.publicPath,
        },
      },
    });
    expect(cacheMock).toHaveBeenCalledOnce();
  });

  it("distinguishes unmanaged and invalid optional hints", async () => {
    fetchMock
      .mockResolvedValueOnce({
        groupJson: null,
        managed: false,
        mappingJson: null,
        parentJson: null,
        resolvedCanonicalPath: null,
      })
      .mockResolvedValueOnce({
        groupJson: null,
        managed: true,
        mappingJson: null,
        parentJson: null,
        resolvedCanonicalPath: null,
      });

    await expect(
      Effect.runPromise(
        readPublishedMaterialContext("en", previewProjection, context)
      )
    ).resolves.toEqual({ managed: false, value: null });
    await expect(
      Effect.runPromise(
        readPublishedMaterialContext("en", previewProjection, context)
      )
    ).resolves.toEqual({ managed: true, value: null });
  });

  it("pins a context read to the expected active release", async () => {
    const activeReleaseId = ReleaseIdSchema.make("release-material");
    fetchMock.mockResolvedValueOnce({
      groupJson: null,
      managed: false,
      mappingJson: null,
      parentJson: null,
      resolvedCanonicalPath: null,
    });

    await expect(
      Effect.runPromise(
        readPublishedMaterialContext(
          "en",
          previewProjection,
          context,
          activeReleaseId
        )
      )
    ).resolves.toEqual({ managed: false, value: null });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ expectedActiveReleaseId: activeReleaseId })
    );
  });

  it("accepts course parents and falls back to the authored group title", async () => {
    const courseParent = {
      ...testProgramSubject,
      level: "course",
    } satisfies CurriculumRoute;
    const groupWithoutCardTitle = {
      ...group,
      materialCardTitle: undefined,
    };
    fetchMock
      .mockResolvedValueOnce({
        ...publishedContext,
        parentJson: testCurriculumRowJson(courseParent),
      })
      .mockResolvedValueOnce({
        ...publishedContext,
        groupJson: testCurriculumRowJson(groupWithoutCardTitle),
      });

    await expect(
      Effect.runPromise(
        readPublishedMaterialContext("en", previewProjection, context)
      )
    ).resolves.toMatchObject({
      managed: true,
      value: { parent: { level: "course" } },
    });
    await expect(
      Effect.runPromise(
        readPublishedMaterialContext("en", previewProjection, context)
      )
    ).resolves.toMatchObject({
      managed: true,
      value: { label: group.title },
    });
  });

  it("accepts a backend-verified renamed material parent", async () => {
    const renamedParent = PublicPathSchema.make(
      "subjects/mathematics/renamed-functions"
    );
    const renamedMaterial = {
      ...previewProjection,
      parentPath: renamedParent,
      publicPath: PublicPathSchema.make(
        `${renamedParent}/renamed-function-concept`
      ),
    };
    fetchMock.mockResolvedValueOnce({
      ...publishedContext,
      resolvedCanonicalPath: renamedParent,
    });

    await expect(
      Effect.runPromise(
        readPublishedMaterialContext("en", renamedMaterial, context)
      )
    ).resolves.toMatchObject({
      managed: true,
      value: {
        mapping: { canonicalPath: mapping.canonicalPath },
      },
    });
  });

  it.each([
    [
      "partial rows",
      {
        groupJson: testCurriculumRowJson(group),
        managed: true,
        mappingJson: testCurriculumRowJson(mapping),
        parentJson: null,
      },
    ],
    [
      "foreign group",
      {
        ...publishedContext,
        groupJson: testCurriculumRowJson({
          ...group,
          nodeKey: `${group.nodeKey}-other`,
        }),
      },
    ],
    [
      "invalid parent level",
      {
        ...publishedContext,
        parentJson: testCurriculumRowJson({
          ...testProgramSubject,
          level: "unit",
        }),
      },
    ],
  ])("rejects %s", async (_label, result) => {
    fetchMock.mockResolvedValueOnce(result);

    await expect(
      Effect.runPromise(
        readPublishedMaterialContext("en", previewProjection, context).pipe(
          Effect.flip
        )
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it("rejects a mapping for a different material route", async () => {
    fetchMock.mockResolvedValueOnce({
      ...publishedContext,
      mappingJson: testCurriculumRowJson({
        ...mapping,
        canonicalPath: PublicPathSchema.make(
          `${previewProjection.parentPath}/other-lesson`
        ),
      }),
      resolvedCanonicalPath: PublicPathSchema.make(
        `${previewProjection.parentPath}/other-lesson`
      ),
    });

    await expect(
      Effect.runPromise(
        readPublishedMaterialContext("en", previewProjection, context).pipe(
          Effect.flip
        )
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });
});
