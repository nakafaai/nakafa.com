import { internal } from "@repo/backend/convex/_generated/api";
import { tryoutProducts } from "@repo/backend/convex/tryouts/products";
import { formatScriptCause } from "@repo/backend/scripts/lib/errors";
import { logError } from "@repo/backend/scripts/sync-content/cli/logging";
import {
  ConvexIdSchema,
  mutableArraySchema,
} from "@repo/backend/scripts/sync-content/contract/schemas";
import {
  callConvexQuery,
  getConvexConfig,
} from "@repo/backend/scripts/sync-content/convex/client";
import { loadEnvProvider } from "@repo/backend/scripts/sync-content/runtime/files";
import type { FunctionArgs, PaginationOptions } from "convex/server";
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

const competitionCampaignProductPageSchema = Schema.mutable(
  Schema.Struct({
    continueCursor: Schema.String,
    isDone: Schema.Boolean,
    page: mutableArraySchema(
      Schema.Struct({
        campaignId: ConvexIdSchema("tryoutAccessCampaigns"),
        endsAt: Schema.Number,
        startsAt: Schema.Number,
      })
    ),
  })
);

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
type TryoutAccessCampaignIntegrityArgs = FunctionArgs<
  typeof internal.tryoutAccess.integrity.internal.getTryoutAccessCampaignIntegrity
>;
type TryoutAccessGrantIntegrityArgs = FunctionArgs<
  typeof internal.tryoutAccess.integrity.internal.getTryoutAccessGrantIntegrity
>;
type TryoutAccessEntitlementIntegrityArgs = FunctionArgs<
  typeof internal.tryoutAccess.integrity.internal.getTryoutAccessEntitlementIntegrity
>;
type CompetitionCampaignProductArgs = FunctionArgs<
  typeof internal.tryoutAccess.integrity.internal.listCompetitionCampaignProductsByProduct
>;

/** Builds pagination options for access verification queries. */
const getTryoutAccessPaginationOpts = (
  continueCursor: string | null
): PaginationOptions => ({
  cursor: continueCursor,
  numItems: TRYOUT_ACCESS_PAGE_SIZE,
});

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
    const args: TryoutAccessCampaignIntegrityArgs = {
      nowMs,
      paginationOpts: getTryoutAccessPaginationOpts(continueCursor),
    };
    const page: TryoutAccessCampaignIntegrityPage = yield* callConvexQuery(
      config,
      internal.tryoutAccess.integrity.internal.getTryoutAccessCampaignIntegrity,
      args,
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
    const args: TryoutAccessGrantIntegrityArgs = {
      nowMs,
      paginationOpts: getTryoutAccessPaginationOpts(continueCursor),
    };
    const page: TryoutAccessGrantIntegrityPage = yield* callConvexQuery(
      config,
      internal.tryoutAccess.integrity.internal.getTryoutAccessGrantIntegrity,
      args,
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
    const args: TryoutAccessEntitlementIntegrityArgs = {
      nowMs,
      paginationOpts: getTryoutAccessPaginationOpts(continueCursor),
    };
    const page: TryoutAccessEntitlementIntegrityPage = yield* callConvexQuery(
      config,
      internal.tryoutAccess.integrity.internal
        .getTryoutAccessEntitlementIntegrity,
      args,
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
      const args: CompetitionCampaignProductArgs = {
        product,
        paginationOpts: getTryoutAccessPaginationOpts(continueCursor),
      };
      const page: CompetitionCampaignProductPage = yield* callConvexQuery(
        config,
        internal.tryoutAccess.integrity.internal
          .listCompetitionCampaignProductsByProduct,
        args,
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
