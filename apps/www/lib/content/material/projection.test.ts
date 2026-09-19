import { describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import { decodePublishedMaterialContext } from "@/lib/content/material/projection";
import { previewProjection } from "@/test/content-preview";
import {
  testCurriculumRowJson,
  testProgramContexts,
  testProgramGroups,
  testProgramSubject,
} from "@/test/content-program";

const [group] = Schema.decodeUnknownSync(Schema.Tuple([CurriculumRouteSchema]))(
  testProgramGroups
);
const [mapping] = Schema.decodeUnknownSync(
  Schema.Tuple([CurriculumRouteSchema])
)(testProgramContexts);
const context = { nodeKey: group.nodeKey, programKey: group.programKey };
const result = {
  groupJson: testCurriculumRowJson(group),
  managed: true,
  mappingJson: testCurriculumRowJson(mapping),
  parentJson: testCurriculumRowJson(testProgramSubject),
  resolvedCanonicalPath: mapping.canonicalPath ?? null,
} satisfies FunctionReturnType<typeof api.contentRelease.program.context>;

describe("published material context projection", () => {
  it.effect("builds the return link only from verified curriculum rows", () =>
    Effect.gen(function* () {
      expect(
        yield* decodePublishedMaterialContext(
          "en",
          previewProjection,
          context,
          result
        )
      ).toMatchObject({
        context,
        group,
        mapping,
        parent: testProgramSubject,
        href: expect.stringContaining(
          "/en/curriculum/merdeka/class-11/mathematics#"
        ),
        label: "Function Composition and Inverses",
        resolvedCanonicalPath: mapping.canonicalPath,
      });
    })
  );

  it.effect("ignores a backend-verified missing optional context", () =>
    Effect.gen(function* () {
      expect(
        yield* decodePublishedMaterialContext(
          "en",
          previewProjection,
          context,
          {
            groupJson: null,
            managed: true,
            mappingJson: null,
            parentJson: null,
            resolvedCanonicalPath: null,
          }
        )
      ).toBeNull();
    })
  );

  it.effect(
    "accepts course parents and uses the authored title without a card title",
    () =>
      Effect.gen(function* () {
        const decoded = yield* decodePublishedMaterialContext(
          "en",
          previewProjection,
          context,
          {
            ...result,
            groupJson: testCurriculumRowJson({
              ...group,
              materialCardTitle: undefined,
            }),
            parentJson: testCurriculumRowJson({
              ...testProgramSubject,
              level: "course",
            }),
          }
        );
        expect(decoded).toMatchObject({
          label: group.title,
          parent: { level: "course" },
        });
      })
  );

  it.effect.each(["parent", "lesson"] as const)(
    "preserves a verified renamed material %s",
    (scope) =>
      Effect.gen(function* () {
        const parentPath = PublicPathSchema.make(
          "subjects/mathematics/renamed-functions"
        );
        const material = {
          ...previewProjection,
          parentPath,
          publicPath: PublicPathSchema.make(
            `${parentPath}/renamed-function-concept`
          ),
        };
        const resolvedCanonicalPath =
          scope === "parent" ? parentPath : material.publicPath;
        expect(
          yield* decodePublishedMaterialContext("en", material, context, {
            ...result,
            resolvedCanonicalPath,
          })
        ).toMatchObject({ mapping, resolvedCanonicalPath });
      })
  );

  it.effect.each([
    ["unmanaged context", { ...result, managed: false }],
    ["missing canonical path", { ...result, resolvedCanonicalPath: null }],
    ["missing group", { ...result, groupJson: null }],
    ["missing mapping", { ...result, mappingJson: null }],
    ["missing parent", { ...result, parentJson: null }],
    [
      "foreign group",
      {
        ...result,
        groupJson: testCurriculumRowJson({
          ...group,
          nodeKey: `${group.nodeKey}-other`,
        }),
      },
    ],
    [
      "invalid parent level",
      {
        ...result,
        parentJson: testCurriculumRowJson({
          ...testProgramSubject,
          level: "unit",
        }),
      },
    ],
    [
      "different material",
      {
        ...result,
        resolvedCanonicalPath: `${previewProjection.parentPath}/other-lesson`,
      },
    ],
    ["malformed row", { ...result, groupJson: "{" }],
  ] satisfies [
    string,
    FunctionReturnType<typeof api.contentRelease.program.context>,
  ][])("rejects %s with the typed projection error", ([, input]) =>
    Effect.gen(function* () {
      expect(
        yield* decodePublishedMaterialContext(
          "en",
          previewProjection,
          context,
          input
        ).pipe(Effect.flip)
      ).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );
});
