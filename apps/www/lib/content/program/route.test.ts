// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { canonicalizeMaterialProjection } from "@nakafa/aksara-contracts/projection/material";
import { Effect } from "effect";
import {
  getPublishedProgramRoute,
  readPublishedProgramRoute,
} from "@/lib/content/program/route";
import { previewIdProjection, previewProjection } from "@/test/content-preview";
import {
  readTestPublishedRoute,
  testCurriculumRowJson,
  testProgramClass,
  testProgramContexts,
  testProgramGroups,
  testProgramRowJson,
  testProgramSubject,
} from "@/test/content-program";

const cacheMock = vi.hoisted(() => vi.fn());
const runtimeQueryMock = vi.hoisted(() => vi.fn());
const revision = "a".repeat(40);

/** Builds one complete route-model response from real Merdeka rows. */
function routeResponse(overrides?: {
  readonly managed?: boolean;
  readonly materialJson?: readonly string[];
  readonly programJson?: null | string;
  readonly routeJson?: null | string;
}) {
  return {
    activeManifestHash: `sha256:${"b".repeat(64)}`,
    activeReleaseId: "program-release",
    alternateJson: [
      testCurriculumRowJson(testProgramSubject),
      testCurriculumRowJson(
        readTestPublishedRoute("kurikulum/merdeka/kelas-11/matematika", "id")
      ),
      testCurriculumRowJson(
        readTestPublishedRoute("lehrplaene/merdeka/klasse-11/mathematik", "de")
      ),
    ],
    ancestorJson: [
      testCurriculumRowJson(readTestPublishedRoute("curriculum/merdeka")),
      testCurriculumRowJson(testProgramClass),
    ],
    childJson: [],
    contextJson: testProgramContexts.map(testCurriculumRowJson),
    groupJson: testProgramGroups.map(testCurriculumRowJson),
    managed: overrides?.managed ?? true,
    materialJson: overrides?.materialJson ?? [
      canonicalizeMaterialProjection(previewProjection),
    ],
    programJson:
      overrides?.programJson === undefined
        ? testProgramRowJson()
        : overrides.programJson,
    routeJson:
      overrides?.routeJson === undefined
        ? testCurriculumRowJson(testProgramSubject)
        : overrides.routeJson,
    snapshotId: `sha256:${"c".repeat(64)}`,
    sourceRevision: revision,
  };
}

vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: cacheMock,
}));
vi.mock("@/lib/content/runtime/query", async () => {
  const { createTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    readRuntimeQuery: createTestRuntimeQuery(runtimeQueryMock),
  };
});

describe("published program route", () => {
  beforeEach(() => {
    cacheMock.mockReset();
    runtimeQueryMock.mockReset();
  });

  it("fails fast when a test route is not part of the signed fixture", () => {
    expect(() => readTestPublishedRoute("curriculum/missing")).toThrow(
      "Missing published route fixture: en/curriculum/missing"
    );
  });

  it.effect("decodes one complete real curriculum route model", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(routeResponse());

      const model = yield* Effect.tryPromise(() =>
        getPublishedProgramRoute("en", testProgramSubject.publicPath)
      );

      expect(model).toMatchObject({
        activeReleaseId: "program-release",
        alternates: [
          { appLocale: "en" },
          { appLocale: "id" },
          { appLocale: "de" },
        ],
        ancestors: [{ level: "track" }, { level: "class" }],
        contexts: expect.any(Array),
        groups: expect.any(Array),
        materials: [{ metadata: { title: "Function Concept" } }],
        program: { key: "merdeka" },
        route: { publicPath: testProgramSubject.publicPath },
        sourceRevision: revision,
      });
      expect(cacheMock).toHaveBeenCalledOnce();
    })
  );

  it.effect("rejects an unmanaged family", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(
        routeResponse({
          managed: false,
          materialJson: [],
          programJson: null,
          routeJson: null,
        })
      );

      const failure = yield* readPublishedProgramRoute(
        "en",
        testProgramSubject.publicPath
      ).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );

  it.effect("distinguishes a managed missing route", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(
        routeResponse({
          materialJson: [],
          programJson: null,
          routeJson: null,
        })
      );

      const model = yield* readPublishedProgramRoute(
        "en",
        "curriculum/missing"
      );
      expect(model).toMatchObject({
        activeReleaseId: "program-release",
        program: null,
        route: null,
        sourceRevision: revision,
      });
    })
  );

  it.effect.each([
    [
      "invalid active release",
      {
        ...routeResponse(),
        activeReleaseId: "invalid release",
      },
    ],
    [
      "managed route without an active release",
      {
        ...routeResponse(),
        activeReleaseId: null,
      },
    ],
    [
      "missing program",
      routeResponse({
        programJson: null,
      }),
    ],
    [
      "mismatched route",
      routeResponse({
        routeJson: testCurriculumRowJson(testProgramClass),
      }),
    ],
    [
      "foreign material locale",
      routeResponse({
        materialJson: [canonicalizeMaterialProjection(previewIdProjection)],
      }),
    ],
  ] as const)("rejects a %s", ([_name, response]) =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce(response);

      const failure = yield* readPublishedProgramRoute(
        "en",
        testProgramSubject.publicPath
      ).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );
});
