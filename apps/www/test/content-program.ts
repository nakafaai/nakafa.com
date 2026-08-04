import {
  CorpusSourcePathSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  type CurriculumRoute,
  CurriculumRouteSchema,
} from "@nakafa/aksara-contracts/program/curriculum";
import {
  type LearningProgram,
  LearningProgramSchema,
} from "@nakafa/aksara-contracts/program/spec";
import {
  type ContentSnapshotRow,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import { findLearningProgramByKey } from "@repo/contents/_types/program/catalog";
import { readStaticPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum/static";
import { Schema } from "effect";
import { previewProjection } from "@/test/content-preview";

const rowHash = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
const sourceRoutes = readStaticPublicCurriculumRoutes();
const sourceProgram = findLearningProgramByKey("merdeka");

/** Exact reviewed Merdeka program adapted to the published wire contract. */
export const testPublishedProgram = Schema.decodeUnknownSync(
  LearningProgramSchema
)(sourceProgram);

/** Adapts one real source route to its Aksara-owned source directory. */
export function readTestPublishedRoute(
  publicPath: string,
  locale: "en" | "id" = "en"
) {
  const route = sourceRoutes.find(
    (candidate) =>
      candidate.locale === locale && candidate.publicPath === publicPath
  );
  return Schema.decodeUnknownSync(CurriculumRouteSchema)({
    ...route,
    sourcePath: CorpusSourcePathSchema.make(
      "packages/corpus/curriculum/merdeka"
    ),
  });
}

/** Serializes one real program as a verified snapshot row fixture. */
export function testProgramRowJson(
  program: LearningProgram = testPublishedProgram
) {
  return canonicalizeContentSnapshotRow({
    family: "program",
    record: { kind: "program", row: program, rowHash },
  } satisfies ContentSnapshotRow);
}

/** Serializes one real curriculum route as a verified snapshot row fixture. */
export function testCurriculumRowJson(route: CurriculumRoute) {
  return canonicalizeContentSnapshotRow({
    family: "program",
    record: { kind: "curriculum", row: route, rowHash },
  } satisfies ContentSnapshotRow);
}

/** Real English Merdeka root used by program runtime tests. */
export const testProgramRoot = readTestPublishedRoute("curriculum/merdeka");

/** Real English Merdeka class route used by program runtime tests. */
export const testProgramClass = readTestPublishedRoute(
  "curriculum/merdeka/class-11"
);

/** Real English mathematics route owning the Function Concept material. */
export const testProgramSubject = readTestPublishedRoute(
  "curriculum/merdeka/class-11/mathematics"
);

/** Real context rows that attach Function Concept to Merdeka mathematics. */
export const testProgramContexts = sourceRoutes
  .filter(
    (route) =>
      route.locale === "en" &&
      route.materialContextParentPath === `${testProgramSubject.publicPath}` &&
      route.materialKey === previewProjection.materialKey
  )
  .map((route) =>
    Schema.decodeUnknownSync(CurriculumRouteSchema)({
      ...route,
      sourcePath: CorpusSourcePathSchema.make(
        "packages/corpus/curriculum/merdeka"
      ),
    })
  );

/** Real card-group row referenced by the Function Concept context. */
export const testProgramGroups = [
  readTestPublishedRoute(
    "curriculum/merdeka/class-11/mathematics/function-composition-inverse-function"
  ),
];
