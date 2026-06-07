import { tryoutProducts } from "@repo/backend/convex/tryouts/products";
import { formatScriptCause } from "@repo/backend/scripts/lib/errors";
import {
  callConvex,
  getConvexConfig,
} from "@repo/backend/scripts/sync-content/convex";
import { logError } from "@repo/backend/scripts/sync-content/logging";
import { loadEnvProvider } from "@repo/backend/scripts/sync-content/runtime";
import { Effect, Schema } from "effect";

const TRYOUT_ACCESS_PAGE_SIZE = 100;

const tryoutAccessCampaignIntegrityPageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  overdueActiveCampaignCount: Schema.Number,
  overduePendingCompetitionCount: Schema.Number,
  overdueScheduledCampaignCount: Schema.Number,
});

const tryoutAccessGrantIntegrityPageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  overdueActiveGrantCount: Schema.Number,
});

const tryoutAccessEntitlementIntegrityPageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  overdueEntitlementCount: Schema.Number,
});

const competitionCampaignProductPageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: Schema.Array(
    Schema.Struct({
      campaignId: Schema.String,
      endsAt: Schema.Number,
      startsAt: Schema.Number,
    })
  ),
});

type TryoutAccessCampaignIntegrityPage = Schema.Schema.Type<
  typeof tryoutAccessCampaignIntegrityPageSchema
>;
type TryoutAccessGrantIntegrityPage = Schema.Schema.Type<
  typeof tryoutAccessGrantIntegrityPageSchema
>;
type TryoutAccessEntitlementIntegrityPage = Schema.Schema.Type<
  typeof tryoutAccessEntitlementIntegrityPageSchema
>;
type CompetitionCampaignProductPage = Schema.Schema.Type<
  typeof competitionCampaignProductPageSchema
>;

/** Reads the full access campaign integrity snapshot. */
const getTryoutAccessCampaignIntegrity = Effect.fn(
  "tryout.getTryoutAccessCampaignIntegrity"
)(function* (prod: boolean) {
  const config = yield* getConvexConfig({ prod });
  const nowMs = Date.now();
  let continueCursor: string | null = null;
  let overdueActiveCampaignCount = 0;
  let overduePendingCompetitionCount = 0;
  let overdueScheduledCampaignCount = 0;

  while (true) {
    const page: TryoutAccessCampaignIntegrityPage = yield* callConvex(
      config,
      "query",
      "tryoutAccess/integrity/internal:getTryoutAccessCampaignIntegrity",
      {
        nowMs,
        paginationOpts: {
          cursor: continueCursor,
          numItems: TRYOUT_ACCESS_PAGE_SIZE,
        },
      },
      tryoutAccessCampaignIntegrityPageSchema
    );

    overdueActiveCampaignCount += page.overdueActiveCampaignCount;
    overduePendingCompetitionCount += page.overduePendingCompetitionCount;
    overdueScheduledCampaignCount += page.overdueScheduledCampaignCount;

    if (page.isDone) {
      return {
        overdueActiveCampaignCount,
        overduePendingCompetitionCount,
        overdueScheduledCampaignCount,
      };
    }

    continueCursor = page.continueCursor;
  }
});

/** Reads the full access grant integrity snapshot. */
const getTryoutAccessGrantIntegrity = Effect.fn(
  "tryout.getTryoutAccessGrantIntegrity"
)(function* (prod: boolean) {
  const config = yield* getConvexConfig({ prod });
  const nowMs = Date.now();
  let continueCursor: string | null = null;
  let overdueActiveGrantCount = 0;

  while (true) {
    const page: TryoutAccessGrantIntegrityPage = yield* callConvex(
      config,
      "query",
      "tryoutAccess/integrity/internal:getTryoutAccessGrantIntegrity",
      {
        nowMs,
        paginationOpts: {
          cursor: continueCursor,
          numItems: TRYOUT_ACCESS_PAGE_SIZE,
        },
      },
      tryoutAccessGrantIntegrityPageSchema
    );

    overdueActiveGrantCount += page.overdueActiveGrantCount;

    if (page.isDone) {
      return {
        overdueActiveGrantCount,
      };
    }

    continueCursor = page.continueCursor;
  }
});

/** Reads the full access entitlement integrity snapshot. */
const getTryoutAccessEntitlementIntegrity = Effect.fn(
  "tryout.getTryoutAccessEntitlementIntegrity"
)(function* (prod: boolean) {
  const config = yield* getConvexConfig({ prod });
  const nowMs = Date.now();
  let continueCursor: string | null = null;
  let overdueEntitlementCount = 0;

  while (true) {
    const page: TryoutAccessEntitlementIntegrityPage = yield* callConvex(
      config,
      "query",
      "tryoutAccess/integrity/internal:getTryoutAccessEntitlementIntegrity",
      {
        nowMs,
        paginationOpts: {
          cursor: continueCursor,
          numItems: TRYOUT_ACCESS_PAGE_SIZE,
        },
      },
      tryoutAccessEntitlementIntegrityPageSchema
    );

    overdueEntitlementCount += page.overdueEntitlementCount;

    if (page.isDone) {
      return {
        overdueEntitlementCount,
      };
    }

    continueCursor = page.continueCursor;
  }
});

/** Reads the full competition overlap integrity snapshot. */
const getCompetitionCampaignProductOverlapIntegrity = Effect.fn(
  "tryout.getCompetitionCampaignProductOverlapIntegrity"
)(function* (prod: boolean) {
  const config = yield* getConvexConfig({ prod });
  let overlappingCompetitionCampaignProductCount = 0;

  for (const product of tryoutProducts) {
    let continueCursor: string | null = null;
    let previousRow: CompetitionCampaignProductPage["page"][number] | null =
      null;

    while (true) {
      const page: CompetitionCampaignProductPage = yield* callConvex(
        config,
        "query",
        "tryoutAccess/integrity/internal:listCompetitionCampaignProductsByProduct",
        {
          product,
          paginationOpts: {
            cursor: continueCursor,
            numItems: TRYOUT_ACCESS_PAGE_SIZE,
          },
        },
        competitionCampaignProductPageSchema
      );

      for (const row of page.page) {
        if (previousRow && previousRow.endsAt > row.startsAt) {
          overlappingCompetitionCampaignProductCount += 1;
        }

        previousRow = row;
      }

      if (page.isDone) {
        break;
      }

      continueCursor = page.continueCursor;
    }
  }

  return {
    overlappingCompetitionCampaignProductCount,
  };
});

/** Runs access-state verification for dev or prod. */
const main = Effect.fn("tryout.verifyAccess")(function* () {
  const flags = yield* Effect.sync(() => process.argv.slice(2));
  const prod = flags.includes("--prod");
  const [campaigns, entitlements, grants, overlap] = yield* Effect.all([
    getTryoutAccessCampaignIntegrity(prod),
    getTryoutAccessEntitlementIntegrity(prod),
    getTryoutAccessGrantIntegrity(prod),
    getCompetitionCampaignProductOverlapIntegrity(prod),
  ]);
  const result = {
    ...campaigns,
    ...entitlements,
    ...grants,
    ...overlap,
  };

  const exitCode =
    result.overdueScheduledCampaignCount > 0 ||
    result.overdueActiveCampaignCount > 0 ||
    result.overduePendingCompetitionCount > 0 ||
    result.overdueEntitlementCount > 0 ||
    result.overdueActiveGrantCount > 0 ||
    result.overlappingCompetitionCampaignProductCount > 0
      ? 1
      : 0;

  yield* Effect.sync(() => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = exitCode;
  });
});

Effect.runPromise(
  Effect.gen(function* () {
    const provider = yield* loadEnvProvider();
    yield* main().pipe(Effect.withConfigProvider(provider));
  }).pipe(
    Effect.catchAllCause((cause) =>
      Effect.sync(() => {
        logError(formatScriptCause(cause));
        process.exitCode = 1;
      })
    )
  )
);
