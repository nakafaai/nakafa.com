import {
  DatabaseReader as ConfectDatabaseReader,
  RegisteredConvexFunction,
} from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import { makeProgramSnapshotRow } from "@nakafa/aksara-contracts/program/snapshot/hash";
import { LearningProgramSchema } from "@nakafa/aksara-contracts/program/spec";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { setPreferredCurriculumProgram } from "@repo/backend/confect/learningPreferences/impl";
import {
  listCurriculumPrograms,
  readCurrentCurriculumProgram,
  saveCurriculumProgram,
} from "@repo/backend/confect/learningPreferences/program";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
  makeTechnicalProgram,
} from "@repo/backend/test/program/snapshot";
import { encodeJsonText } from "@repo/utilities/json";
import { convexTest } from "convex-test";
import { Array as Arr, Effect, Schema } from "effect";

describe("learningPreferences/program", () => {
  it.effect("returns no curriculum for a retired saved key", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const test = createConvexTestWithBetterAuth();
      const data = yield* makeProgramSnapshotData();
      yield* Effect.promise(() =>
        test.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            activateProgramSnapshot(data).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      const userId = yield* Effect.promise(() =>
        test.mutation(async (ctx) => {
          const user = await seedAuthenticatedUser(ctx, {
            now: 1,
          });
          await Effect.runPromiseWith(runtimeServices)(
            setPreferredCurriculumProgram({
              now: 1,
              programKey: "retired-program",
              userId: user.userId,
            }).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          );
          return user.userId;
        })
      );
      expect(
        yield* Effect.promise(() =>
          test.query((_ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              readCurrentCurriculumProgram("en", userId).pipe(
                Effect.provide(
                  ConfectDatabaseReader.layer(confectSchema, _ctx.db)
                )
              )
            )
          )
        )
      ).toBeNull();
    })
  );
  it.effect(
    "maps preference read and write failures to the curriculum error contract",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const test = createConvexTestWithBetterAuth();
        const data = yield* makeProgramSnapshotData();
        yield* Effect.promise(() =>
          test.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              activateProgramSnapshot(data).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        const userId = yield* Effect.promise(() =>
          test.mutation(
            async (ctx) =>
              (
                await seedAuthenticatedUser(ctx, {
                  now: 1,
                })
              ).userId
          )
        );
        yield* Effect.promise(() =>
          test.query(async (ctx) => {
            vi.spyOn(ctx.db, "query").mockImplementation(() => {
              throw new TypeError("private query detail");
            });
            const failure = await Effect.runPromiseWith(runtimeServices)(
              readCurrentCurriculumProgram("en", userId).pipe(
                Effect.flip,
                Effect.orDie,
                Effect.provide(
                  ConfectDatabaseReader.layer(confectSchema, ctx.db)
                )
              )
            );
            expect(failure).toMatchObject({
              _tag: "CurriculumPreferenceError",
              code: "CURRICULUM_PREFERENCE_IO_FAILED",
            });
            expect(encodeJsonText(failure)).not.toContain(
              "private query detail"
            );
          })
        );
        yield* Effect.promise(() =>
          test.mutation(async (ctx) => {
            vi.spyOn(ctx.db, "insert").mockRejectedValue(
              "private write detail"
            );
            const failure = await Effect.runPromiseWith(runtimeServices)(
              saveCurriculumProgram("en", "technical-program-1", userId).pipe(
                Effect.flip,
                Effect.orDie,
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            );
            expect(failure).toMatchObject({
              _tag: "CurriculumPreferenceError",
              code: "CURRICULUM_PREFERENCE_IO_FAILED",
            });
            expect(encodeJsonText(failure)).not.toContain(
              "private write detail"
            );
          })
        );
      })
  );
  it.effect(
    "rejects a signed program row that loses its requested translation",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const test = convexTest(schema, convexModules);
        const data = yield* makeProgramSnapshotData([makeTechnicalProgram(1)]);
        yield* Effect.promise(() =>
          test.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              activateProgramSnapshot(data).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        const original = makeTechnicalProgram(1);
        const program = yield* Schema.decodeUnknownEffect(
          LearningProgramSchema
        )({
          ...original,
          translations: Arr.filter(
            original.translations,
            ({ appLocale }) => appLocale !== "en"
          ),
        });
        const record = yield* makeProgramSnapshotRow(program);
        yield* Effect.promise(() =>
          test.mutation(async (ctx) => {
            const row = await ctx.db.query("programCatalog").unique();
            if (!row) {
              expect.fail("Expected the current program catalog row.");
            }
            await ctx.db.patch("programCatalog", row._id, {
              rowHash: record.rowHash,
              rowJson: canonicalizeContentSnapshotRow({
                family: "program",
                record,
              }),
            });
          })
        );
        yield* Effect.promise(() =>
          expect(
            test.query((_ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                listCurriculumPrograms("en").pipe(
                  Effect.provide(
                    ConfectDatabaseReader.layer(confectSchema, _ctx.db)
                  )
                )
              )
            )
          ).rejects.toMatchObject({
            code: "CURRICULUM_PREFERENCE_IO_FAILED",
            message:
              "Curriculum program technical-program-1 has no en translation.",
          })
        );
      })
  );
  it.effect("fails closed when no signed program snapshot is active", () => {
    const t = convexTest(schema, convexModules);
    return Effect.promise(() =>
      expect(
        t.query((_ctx) =>
          Effect.runPromise(
            listCurriculumPrograms("en").pipe(
              Effect.provide(
                ConfectDatabaseReader.layer(confectSchema, _ctx.db)
              )
            )
          )
        )
      ).rejects.toMatchObject({
        code: "CONTENT_RELEASE_MISSING",
      })
    );
  });
  it.effect(
    "filters program kinds before enforcing the curriculum preference limit",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const unrelated = Array.from(
          {
            length: 51,
          },
          (_, index) => makeTechnicalProgram(index + 1, "admission-exam")
        );
        const curricula = [makeTechnicalProgram(52), makeTechnicalProgram(53)];
        const data = yield* makeProgramSnapshotData([
          ...unrelated,
          ...curricula,
        ]);
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              activateProgramSnapshot(data, 16).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        yield* Effect.promise(() =>
          expect(
            t.query((_ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                listCurriculumPrograms("en").pipe(
                  Effect.provide(
                    ConfectDatabaseReader.layer(confectSchema, _ctx.db)
                  )
                )
              )
            )
          ).resolves.toMatchObject([
            {
              key: "technical-program-52",
            },
            {
              key: "technical-program-53",
            },
          ])
        );
      })
  );
  it.effect(
    "rejects a published preference list beyond its bounded UI contract",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const programs = Array.from(
          {
            length: 51,
          },
          (_, index) => makeTechnicalProgram(index + 1)
        );
        const data = yield* makeProgramSnapshotData(programs);
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              activateProgramSnapshot(data, 16).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        yield* Effect.promise(() =>
          expect(
            t.query((_ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                listCurriculumPrograms("en").pipe(
                  Effect.provide(
                    ConfectDatabaseReader.layer(confectSchema, _ctx.db)
                  )
                )
              )
            )
          ).rejects.toThrow("Curriculum program catalog exceeds 50 rows.")
        );
      })
  );
});
