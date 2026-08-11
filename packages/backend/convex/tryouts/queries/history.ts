import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { query } from "@repo/backend/convex/_generated/server";
import type { TryoutSetIdentity } from "@repo/backend/convex/contentRelease/tryout/set";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  decodeTryoutSetIdentity,
  tryoutSetIdentityValidator,
} from "@repo/backend/convex/tryouts/route";
import { tryRuntimePromise } from "@repo/backend/convex/tryouts/runtime/error";
import {
  readAttemptHistoryPage,
  readAttemptHistoryPageBySet,
} from "@repo/backend/convex/tryouts/runtime/lookup";
import { tryoutScoreResultValidator } from "@repo/backend/convex/tryouts/score";
import { loadAttemptScoreResult } from "@repo/backend/convex/tryouts/score/result";
import { tryoutStatusValidator } from "@repo/backend/convex/tryouts/status";
import {
  type PaginationOptions,
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const MAX_HISTORY_ROWS_READ = 25;

const historyRowValidator = v.object({
  attemptId: v.id("tryoutAttempts"),
  attemptNumber: v.number(),
  completedAt: v.union(v.number(), v.null()),
  score: v.union(tryoutScoreResultValidator, v.null()),
  startedAt: v.number(),
  status: tryoutStatusValidator,
});

type HistoryRequest =
  | {
      readonly kind: "path";
      readonly path: {
        readonly locale: TryoutSetIdentity["locale"];
        readonly publicPath: string;
      };
    }
  | {
      readonly identity: TryoutSetIdentity;
      readonly kind: "set";
    };

/** Selects the deployed path reader or the exact logical-identity reader. */
const readHistoryAttempts = Effect.fn("tryouts.queries.history.readAttempts")(
  function* (
    ctx: QueryCtx,
    request: HistoryRequest,
    userId: Id<"users">,
    pagination: PaginationOptions
  ) {
    if (request.kind === "path") {
      return yield* readAttemptHistoryPage(
        ctx,
        request.path,
        userId,
        pagination
      );
    }

    return yield* readAttemptHistoryPageBySet(
      ctx,
      request.identity,
      userId,
      pagination
    );
  }
);

/** Loads and projects one bounded history page for the current app user. */
const readHistoryPage = Effect.fn("tryouts.queries.history.readPage")(
  function* (
    ctx: QueryCtx,
    request: HistoryRequest,
    paginationOpts: PaginationOptions
  ) {
    const { appUser } = yield* tryRuntimePromise(() => requireAuth(ctx));
    const pagination = {
      ...paginationOpts,
      maximumRowsRead: Math.min(
        paginationOpts.maximumRowsRead ?? MAX_HISTORY_ROWS_READ,
        MAX_HISTORY_ROWS_READ
      ),
      numItems: Math.min(paginationOpts.numItems, MAX_HISTORY_ROWS_READ),
    };
    const history = yield* readHistoryAttempts(
      ctx,
      request,
      appUser._id,
      pagination
    );
    const page = yield* Effect.forEach(
      history.page,
      (attempt) =>
        loadAttemptScoreResult(ctx, attempt).pipe(
          Effect.map((score) => ({
            attemptId: attempt._id,
            attemptNumber: attempt.attemptNumber,
            completedAt: attempt.completedAt,
            score,
            startedAt: attempt.startedAt,
            status: attempt.status,
          }))
        ),
      { concurrency: "unbounded" }
    );

    return { ...history, page };
  }
);

/** Keeps the deployed public-path history contract for active browser tabs. */
export const list = query({
  args: {
    locale: localeValidator,
    paginationOpts: paginationOptsValidator,
    publicPath: v.string(),
  },
  returns: paginationResultValidator(historyRowValidator),
  handler: (ctx, args) =>
    runConvexProgram(
      readHistoryPage(
        ctx,
        {
          kind: "path",
          path: { locale: args.locale, publicPath: args.publicPath },
        },
        args.paginationOpts
      )
    ),
});

/** Returns bounded score history through one immutable signed set identity. */
export const bySet = query({
  args: {
    paginationOpts: paginationOptsValidator,
    ...tryoutSetIdentityValidator.fields,
  },
  returns: paginationResultValidator(historyRowValidator),
  handler: (ctx, args) => {
    const { paginationOpts, ...identity } = args;
    return runConvexProgram(
      decodeTryoutSetIdentity(identity).pipe(
        Effect.flatMap((decodedIdentity) =>
          readHistoryPage(
            ctx,
            { identity: decodedIdentity, kind: "set" },
            paginationOpts
          )
        )
      )
    );
  },
});
