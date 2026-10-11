import { DatabaseReader as ConfectDatabaseReader } from "@confect/server";
import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import {
  type MaterialLessonProjection,
  MaterialLessonProjectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import confectSchema from "@repo/backend/confect/_generated/schema";
import {
  type LearningContextInput,
  toLearningContextQuery,
} from "@repo/backend/confect/contents/context";
import { resolveLearningContext } from "@repo/backend/confect/contents/views/context";
import { validateIncomingContentTarget } from "@repo/backend/confect/contents/views/target";
import { convexModules } from "@repo/backend/confect/test.setup";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { FUNCTION_MATERIAL } from "@repo/backend/test/content/material";
import {
  activatePlacement,
  GROUP_KEY,
  GROUP_PATH,
  PLACEMENT,
  PROGRAM_KEY,
  SUBJECT_PATH,
} from "@repo/backend/test/content/placement";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import {
  CONTENT_VIEW_NOW,
  makeMaterialViewArgs,
  readContentViewState,
} from "@repo/backend/test/content/view";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import { readMaterialContextHint } from "@repo/contents/route/material/context";
import type { TestConvex } from "convex-test";
import { convexTest } from "convex-test";
import { Array as Arr, Data, Effect, Order, Schema } from "effect";

const RENAMED_MATERIAL = MaterialLessonProjectionSchema.make({
  ...FUNCTION_MATERIAL,
  publicPath: PublicPathSchema.make(
    `${FUNCTION_MATERIAL.parentPath}/function-concept-renamed`
  ),
});
class ObservedContextQueryFailure extends Schema.TaggedError<ObservedContextQueryFailure>()(
  "ObservedContextQueryFailure",
  {
    cause: Schema.Unknown,
  }
) {}
class UnexpectedContextTestState extends Data.TaggedError(
  "UnexpectedContextTestState"
)<{
  readonly operation: "resolve-current-material";
}> {}

/** Resolves context through the current signed material target. */
const readContext = Effect.fn("contents.views.test.readContext")(function* (
  target: TestConvex<typeof schema>,
  projection: MaterialLessonProjection,
  context?: LearningContextInput
) {
  const runtimeServices = yield* Effect.context<never>();
  return yield* Effect.tryPromise({
    catch: (cause) =>
      new ObservedContextQueryFailure({
        cause,
      }),
    try: () =>
      target.query((ctx) =>
        Effect.runPromiseWith(runtimeServices)(
          Effect.gen(function* () {
            const material = yield* validateIncomingContentTarget({
              contentId: projection.graph.assetId,
              locale: "en",
              publicPath: projection.publicPath,
              section: "material",
            });
            if (!material) {
              return yield* Effect.die(
                new UnexpectedContextTestState({
                  operation: "resolve-current-material",
                })
              );
            }
            return yield* resolveLearningContext(material, context);
          }).pipe(
            Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
          )
        )
      ),
  });
});

describe("contents/views/context", () => {
  it.effect.each([
    {
      mode: "placement",
    },
    {
      mode: "placement",
      nodeKey: GROUP_KEY,
    },
    {
      mode: "placement",
      programKey: PROGRAM_KEY,
    },
  ] satisfies LearningContextInput[])(
    "keeps an incomplete placement hint canonical: %j",
    (hint) =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          target.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              activateMaterialCatalog([FUNCTION_MATERIAL]).pipe(
                Effect.provide(mutationLayer(confectSchema, ctx))
              )
            )
          )
        );
        expect(yield* readContext(target, FUNCTION_MATERIAL, hint)).toEqual({
          contextKey: "canonical",
          contextMode: "canonical",
        });
      })
  );
  it("keeps article visits canonical even when a curriculum placement hint is supplied", async () => {
    const target = convexTest(schema, convexModules);
    const projection = testArticleProjection(0);
    await target.mutation((ctx) => insertRuntimeArticles(ctx, 1));
    await target.query(async (ctx) => {
      const article = await Effect.runPromise(
        validateIncomingContentTarget({
          contentId: projection.graph.assetId,
          locale: "en",
          publicPath: projection.publicPath,
          section: "articles",
        }).pipe(
          Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
        )
      );
      if (!article) {
        expect.fail("Expected the signed article target.");
      }
      expect(
        await Effect.runPromise(
          resolveLearningContext(article, PLACEMENT).pipe(
            Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
          )
        )
      ).toEqual({
        contextKey: "canonical",
        contextMode: "canonical",
      });
    });
  });
  it.effect("keeps a direct visit canonical", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const target = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        target.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            activateMaterialCatalog([FUNCTION_MATERIAL]).pipe(
              Effect.provide(mutationLayer(confectSchema, ctx))
            )
          )
        )
      );
      expect(yield* readContext(target, FUNCTION_MATERIAL)).toEqual({
        contextKey: "canonical",
        contextMode: "canonical",
      });
    })
  );
  it.effect(
    "falls back to canonical context when signed curriculum ownership is unavailable",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const target = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          target.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              activateMaterialCatalog([FUNCTION_MATERIAL]).pipe(
                Effect.provide(mutationLayer(confectSchema, ctx))
              )
            )
          )
        );
        expect(
          yield* readContext(target, FUNCTION_MATERIAL, PLACEMENT)
        ).toEqual({
          contextKey: "canonical",
          contextMode: "canonical",
        });
      })
  );
  it.effect("resolves an exact current signed curriculum placement", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      yield* activatePlacement(target, FUNCTION_MATERIAL.publicPath);
      expect(
        yield* readContext(target, FUNCTION_MATERIAL, PLACEMENT)
      ).toMatchObject({
        contextKey: `placement:${PROGRAM_KEY}:${GROUP_KEY}`,
        contextMaterialKey: FUNCTION_MATERIAL.materialKey,
        contextMode: "placement",
        contextNodeKey: GROUP_KEY,
        contextParentPath: SUBJECT_PATH,
        contextProgramKey: PROGRAM_KEY,
        contextPublicPath: GROUP_PATH,
      });
    })
  );
  it.effect(
    "keeps a stable parent placement after a signed lesson rename",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        yield* activatePlacement(
          target,
          FUNCTION_MATERIAL.parentPath,
          RENAMED_MATERIAL
        );
        expect(
          yield* readContext(target, RENAMED_MATERIAL, PLACEMENT)
        ).toMatchObject({
          contextKey: `placement:${PROGRAM_KEY}:${GROUP_KEY}`,
          contextMaterialKey: FUNCTION_MATERIAL.materialKey,
          contextMode: "placement",
        });
      })
  );
  it.effect("makes an unverified signed placement canonical", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      yield* activatePlacement(target, FUNCTION_MATERIAL.publicPath);
      expect(
        yield* readContext(target, FUNCTION_MATERIAL, {
          mode: "placement",
          nodeKey: "missing-group",
          programKey: PROGRAM_KEY,
        })
      ).toEqual({
        contextKey: "canonical",
        contextMode: "canonical",
      });
    })
  );
});
it.effect(
  "records a verified placement view in the global popularity scope only",
  () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      yield* activatePlacement(target, FUNCTION_MATERIAL.publicPath);
      const context = yield* readContext(target, FUNCTION_MATERIAL, PLACEMENT);
      expect(context).toMatchObject({
        contextMode: "placement",
        contextNodeKey: GROUP_KEY,
      });
      expect(context).toHaveProperty("contextParentPath", SUBJECT_PATH);
      expect(context).toHaveProperty("contextPublicPath", GROUP_PATH);
      expect(
        readMaterialContextHint(
          new URLSearchParams(toLearningContextQuery(context)).get("ctx")
        )
      ).toEqual({
        nodeKey: GROUP_KEY,
        programKey: PROGRAM_KEY,
      });
      expect(
        toLearningContextQuery({
          ...context,
          contextProgramKey: "",
        })
      ).toBe("");
      expect(
        toLearningContextQuery({
          ...context,
          contextNodeKey: "",
        })
      ).toBe("");
      yield* Effect.promise(() =>
        target.mutation(api.contents.mutations.views.recordContentView, {
          contentId: FUNCTION_MATERIAL.graph.assetId,
          publicPath: FUNCTION_MATERIAL.publicPath,
          locale: "en",
          section: "material",
          deviceId: "placement",
          context: PLACEMENT,
        })
      );
      const scopes = yield* Effect.promise(() =>
        target.query(async (ctx) =>
          Arr.map(
            await ctx.db.query("learningEngagementQueue").collect(),
            (row) => row.scopeMode
          )
        )
      );
      // The homepage ranks every lesson once, whatever page it was reached from.
      expect(Arr.sort(scopes, Order.String)).toEqual(["global"]);
    })
);
describe("contents/views/context popularity", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: CONTENT_VIEW_NOW });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it.effect.each([
    {
      first: undefined,
      label: "directly, then through a placement",
      second: PLACEMENT,
    },
    {
      first: PLACEMENT,
      label: "through a placement, then directly",
      second: undefined,
    },
  ] as const)(
    "counts a lesson once when one device reaches it $label on one day",
    ({ first, second }) =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        yield* activatePlacement(target, FUNCTION_MATERIAL.publicPath);
        const view = (context: LearningContextInput | undefined) =>
          Effect.promise(() =>
            target.mutation(api.contents.mutations.views.recordContentView, {
              ...makeMaterialViewArgs("shared-device"),
              ...(context ? { context } : {}),
            })
          );

        yield* view(first);
        yield* view(second);

        const state = yield* Effect.promise(() => readContentViewState(target));
        // The device has one view per page it reached the lesson from, but the
        // homepage ranking counts the lesson for that device once.
        expect(
          Arr.sort(
            Arr.map(state.views, ({ contextMode }) => contextMode),
            Order.String
          )
        ).toEqual(["canonical", "placement"]);
        expect(state.engagementQueue).toHaveLength(1);
        expect(state.viewerSignals).toHaveLength(1);
        expect(state.engagementQueue[0]).toMatchObject({
          contextKey: "canonical",
          scopeMode: "global",
          viewerKey: "device:shared-device",
        });
      })
  );
});
