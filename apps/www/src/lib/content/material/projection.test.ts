import type { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import { LearningProgramKeySchema } from "@nakafa/aksara-contracts/program/spec";
import type contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";

import { Effect, Schema } from "effect";
import { decodePublishedMaterialContext } from "@/lib/content/material/projection";
import { previewProjection } from "@/test/content-preview";
import {
  testCurriculumRowJson,
  testProgramClass,
  testProgramContexts,
  testProgramGroups,
  testProgramRoot,
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
  ancestorJson: [
    testCurriculumRowJson(testProgramRoot),
    testCurriculumRowJson(testProgramClass),
  ],
  groupJson: testCurriculumRowJson(group),
  mappingJson: testCurriculumRowJson(mapping),
  parentJson: testCurriculumRowJson(testProgramSubject),
  resolvedCanonicalPath: mapping.canonicalPath ?? "",
} satisfies Ref.Returns<typeof contentRelease.program.placements>[number];

describe("published material context projection", () => {
  it.effect("builds the return link only from verified curriculum rows", () =>
    Effect.gen(function* () {
      expect(
        yield* decodePublishedMaterialContext("en", previewProjection, result)
      ).toMatchObject({
        context,
        group,
        mapping,
        parent: testProgramSubject,
        hash: expect.any(String),
        label: "Function Composition and Inverses",
        resolvedCanonicalPath: mapping.canonicalPath,
      });
    })
  );

  it.effect(
    "accepts course parents and uses the authored title without a card title",
    () =>
      Effect.gen(function* () {
        const decoded = yield* decodePublishedMaterialContext(
          "en",
          previewProjection,
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
          yield* decodePublishedMaterialContext("en", material, {
            ...result,
            resolvedCanonicalPath,
          })
        ).toMatchObject({ mapping, resolvedCanonicalPath });
      })
  );

  it.effect.each([
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
      "foreign ancestor",
      {
        ...result,
        ancestorJson: [
          testCurriculumRowJson({
            ...testProgramRoot,
            programKey: LearningProgramKeySchema.make("other-program"),
          }),
          testCurriculumRowJson(testProgramClass),
        ],
      },
    ],
    [
      "ancestor of another locale",
      {
        ...result,
        ancestorJson: [
          testCurriculumRowJson({
            ...testProgramRoot,
            appLocale: AppLocaleSchema.make("id"),
          }),
          testCurriculumRowJson(testProgramClass),
        ],
      },
    ],
    [
      "broken ancestor chain",
      {
        ...result,
        ancestorJson: [testCurriculumRowJson(testProgramRoot)],
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
    Ref.Returns<typeof contentRelease.program.placements>[number],
  ][])("rejects %s with the typed projection error", ([, input]) =>
    Effect.gen(function* () {
      expect(
        yield* decodePublishedMaterialContext(
          "en",
          previewProjection,
          input
        ).pipe(Effect.flip)
      ).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );
});
