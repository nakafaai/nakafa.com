import type {
  ActionCtx,
  MutationCtx,
} from "@repo/backend/convex/_generated/server";
import {
  env,
  internalAction,
  internalMutation,
} from "@repo/backend/convex/_generated/server";
import { compactRows } from "@repo/backend/convex/contentRelease/compact/rows";
import {
  type CompactionCycle,
  ensureCompaction,
} from "@repo/backend/convex/contentRelease/compact/state";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { compactionReceiptValidator } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Config, ConfigProvider, Effect, Option, Schema } from "effect";

const RUN_PAGE_LIMIT = 64;
type CompactionReceipt = Infer<typeof compactionReceiptValidator>;

/** Only the explicitly configured loopback build runtime may omit lifecycle data. */
const isStaticBuild = Effect.fn("contentRelease.readStaticBuildConfiguration")(
  function* () {
    const provider = ConfigProvider.fromEnvRecord(env);
    const mode = yield* Config.option(
      Config.schema(Schema.Literal("local-static"), "CONTENT_RUNTIME_BUILD")
    ).parse(provider);
    if (Option.isNone(mode)) {
      return false;
    }
    const urls = yield* Config.all({
      cloud: Config.schema(Schema.URL, "CONVEX_CLOUD_URL"),
      site: Config.schema(Schema.URL, "CONVEX_SITE_URL"),
    }).parse(provider);
    if (
      urls.cloud.hostname !== urls.site.hostname ||
      urls.cloud.port === urls.site.port ||
      Object.values(urls).some(
        (url) =>
          url.protocol !== "http:" ||
          !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
          !url.port ||
          url.username !== "" ||
          url.password !== "" ||
          url.pathname !== "/" ||
          url.search !== "" ||
          url.hash !== ""
      )
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        "Static content builds require paired loopback Convex URLs."
      );
    }
    return true;
  },
  Effect.catchTag("ConfigError", () =>
    Effect.fail(
      new ReleaseError({
        code: "CONTENT_RELEASE_STATE",
        message: "Static content build configuration is invalid.",
      })
    )
  )
);

const compactPageReference = makeFunctionReference<
  "mutation",
  Record<string, never>,
  CompactionReceipt
>("contentRelease/compact:page");

/** Returns the next durable phase after all rows in one table are exhausted. */
function nextPhase(
  phase: CompactionCycle["phase"]
): CompactionCycle["phase"] | null {
  if (phase === "heads") {
    return "bindings";
  }
  if (phase === "bindings") {
    return "items";
  }
  if (phase === "items") {
    return "batches";
  }
  if (phase === "batches") {
    return "artifacts";
  }
  if (phase === "artifacts") {
    return "snapshots";
  }
  if (phase === "snapshots") {
    return "releases";
  }
  return null;
}

/** Persists one completed table phase or the final compacted floor. */
const advancePhase = Effect.fn("contentRelease.advanceCompaction")(function* (
  ctx: MutationCtx,
  cycle: CompactionCycle
) {
  const phase = nextPhase(cycle.phase);
  const now = Date.now();
  if (phase) {
    yield* Effect.promise(() =>
      ctx.db.patch("contentState", cycle.state._id, {
        compactCursor: undefined,
        compactPhase: phase,
        updatedAt: now,
      })
    );
    return { complete: false, phase };
  }
  yield* Effect.promise(() =>
    ctx.db.patch("contentState", cycle.state._id, {
      compactCursor: undefined,
      compactFloor: undefined,
      compactFrom: undefined,
      compactPhase: undefined,
      compactStartedAt: undefined,
      compactedFloor: cycle.floor,
      updatedAt: now,
    })
  );
  return { complete: true, phase: cycle.phase };
});

/** Runs one transactional, resumable history-compaction page. */
export const compactProgram = Effect.fn("contentRelease.compactPage")(
  function* (ctx: MutationCtx) {
    if (yield* isStaticBuild()) {
      return {
        complete: true,
        deleted: 0,
        floor: 0,
        phase: "releases",
      } satisfies CompactionReceipt;
    }
    const work = yield* ensureCompaction(ctx);
    if (work.complete) {
      const phase: CompactionCycle["phase"] = "releases";
      return {
        complete: true,
        deleted: 0,
        floor: work.floor,
        phase,
      };
    }
    const { cycle } = work;
    if (cycle.state.compactPhase === undefined) {
      return {
        complete: false,
        deleted: 0,
        floor: cycle.floor,
        phase: cycle.phase,
      };
    }
    const result = yield* compactRows(
      ctx,
      cycle.phase,
      cycle.from,
      cycle.floor,
      cycle.cursor,
      cycle.startedAt
    );
    if (!result.done) {
      yield* Effect.promise(() =>
        ctx.db.patch("contentState", cycle.state._id, {
          compactCursor: result.cursor ?? undefined,
          updatedAt: Date.now(),
        })
      );
      return {
        complete: false,
        deleted: result.deleted,
        floor: cycle.floor,
        phase: cycle.phase,
      };
    }
    const progress = yield* advancePhase(ctx, cycle);
    return {
      complete: progress.complete,
      deleted: result.deleted,
      floor: cycle.floor,
      phase: progress.phase,
    };
  }
);

/** Executes a bounded number of persisted pages for one scheduled run. */
export const runProgram = Effect.fn("contentRelease.runCompaction")(function* (
  ctx: ActionCtx
) {
  if (yield* isStaticBuild()) {
    return {
      complete: true,
      deleted: 0,
      floor: 0,
      phase: "releases",
    } satisfies CompactionReceipt;
  }
  let deleted = 0;
  let latest: {
    readonly complete: boolean;
    readonly deleted: number;
    readonly floor: number;
    readonly phase: CompactionCycle["phase"];
  } = {
    complete: true,
    deleted: 0,
    floor: 0,
    phase: "releases",
  };
  for (let index = 0; index < RUN_PAGE_LIMIT; index += 1) {
    const receipt = yield* callInternal(() =>
      ctx.runMutation(compactPageReference, {})
    );
    deleted += receipt.deleted;
    latest = { ...receipt, deleted };
    if (receipt.complete) {
      return latest;
    }
  }
  return latest;
});

/** Internal mutation owning one crash-safe compaction transaction. */
export const page = internalMutation({
  args: {},
  returns: compactionReceiptValidator,
  handler: (ctx) => runConvexProgram(compactProgram(ctx)),
});

/** Scheduled action draining bounded pages without one oversized mutation. */
export const run = internalAction({
  args: {},
  returns: compactionReceiptValidator,
  handler: (ctx) => runConvexProgram(runProgram(ctx)),
});
