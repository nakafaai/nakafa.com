// @vitest-environment node
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeContentRoute } from "@/lib/content/runtime/routes";
import { reconcileMaterialLlmsRows } from "@/lib/llms/material";
import {
  previewNextProjection,
  previewProjection,
} from "@/test/content-preview";

const mockReadClaims = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-material");

vi.mock("@/lib/content/material/ownership", () => ({
  readPublishedMaterialClaims: mockReadClaims,
}));

const sourceRow = {
  ...previewProjection.graph,
  authors: previewProjection.metadata.authors.map(({ name }) => ({ name })),
  content_id: previewProjection.graph.assetId,
  description: previewProjection.metadata.description,
  kind: "curriculum-lesson",
  locale: previewProjection.locale,
  markdown: true,
  route: previewProjection.publicPath,
  section: "material",
  sourceParentPath: previewProjection.parentPath,
  sourcePath: previewProjection.contentKey,
  syncedAt: 1,
  title: previewProjection.metadata.title,
} satisfies RuntimeContentRoute;
const sourceRows = [
  sourceRow,
  {
    ...sourceRow,
    ...previewNextProjection.graph,
    authors: previewNextProjection.metadata.authors.map(({ name }) => ({
      name,
    })),
    content_id: previewNextProjection.graph.assetId,
    description: previewNextProjection.metadata.description,
    markdown: false,
    route: previewNextProjection.publicPath,
    sourceParentPath: previewNextProjection.parentPath,
    sourcePath: previewNextProjection.contentKey,
    title: previewNextProjection.metadata.title,
  },
] satisfies readonly RuntimeContentRoute[];

beforeEach(() => {
  mockReadClaims.mockReset().mockReturnValue(Effect.succeed([]));
});

describe("LLMS material ownership", () => {
  it("keeps unclaimed source rows and sends only lesson identities", async () => {
    await expect(
      Effect.runPromise(
        reconcileMaterialLlmsRows("en", sourceRows, activeReleaseId)
      )
    ).resolves.toEqual(sourceRows);
    expect(mockReadClaims).toHaveBeenCalledWith(
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

  it("replaces found rows and removes exact tombstones", async () => {
    mockReadClaims.mockReturnValueOnce(
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
        reconcileMaterialLlmsRows("en", sourceRows, activeReleaseId)
      )
    ).resolves.toEqual([sourceRows[1]]);

    mockReadClaims.mockReturnValueOnce(
      Effect.succeed([
        {
          contentKey: previewProjection.contentKey,
          kind: "missing",
          locale: "en",
        },
      ])
    );
    await expect(
      Effect.runPromise(
        reconcileMaterialLlmsRows("en", sourceRows, activeReleaseId)
      )
    ).resolves.toEqual([sourceRows[1]]);
  });
});
