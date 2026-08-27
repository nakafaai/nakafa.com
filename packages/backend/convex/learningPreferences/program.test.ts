import { describe, expect, it } from "@effect/vitest";
import { listCurriculumPrograms } from "@repo/backend/convex/learningPreferences/program";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
  makeTechnicalProgram,
} from "@repo/backend/test/program-snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("learningPreferences/program", () => {
  it.effect(
    "filters program kinds before enforcing the curriculum preference limit",
    () =>
      Effect.gen(function* () {
        const unrelated = Array.from({ length: 51 }, (_, index) =>
          makeTechnicalProgram(index + 1, "admission-exam")
        );
        const curricula = [makeTechnicalProgram(52), makeTechnicalProgram(53)];
        const data = yield* makeProgramSnapshotData([
          ...unrelated,
          ...curricula,
        ]);
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateProgramSnapshot(t, data, 16));

        yield* Effect.promise(() =>
          expect(
            t.query((ctx) =>
              runConvexProgram(listCurriculumPrograms(ctx, "en"))
            )
          ).resolves.toMatchObject([
            { key: "technical-program-52" },
            { key: "technical-program-53" },
          ])
        );
      })
  );

  it.effect(
    "rejects a published preference list beyond its bounded UI contract",
    () =>
      Effect.gen(function* () {
        const programs = Array.from({ length: 51 }, (_, index) =>
          makeTechnicalProgram(index + 1)
        );
        const data = yield* makeProgramSnapshotData(programs);
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateProgramSnapshot(t, data, 16));

        yield* Effect.promise(() =>
          expect(
            t.query((ctx) =>
              runConvexProgram(listCurriculumPrograms(ctx, "en"))
            )
          ).rejects.toThrow("Curriculum program catalog exceeds 50 rows.")
        );
      })
  );
});
