import type { Ref } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { tryoutProducts } from "@repo/backend/confect/modules/tryout/products";
import { formatScriptCause } from "@repo/backend/scripts/lib/errors";
import {
  callConvex,
  getConvexConfig,
} from "@repo/backend/scripts/sync-content/convex";
import { logError } from "@repo/backend/scripts/sync-content/logging";
import { loadEnvProvider } from "@repo/backend/scripts/sync-content/runtime";
import { Clock, Effect } from "effect";

const TRYOUT_ACCESS_PAGE_SIZE = 100;

type CompetitionCampaignProduct = Ref.Returns<
  typeof refs.internal.tryoutAccess.queries.internalFunctions.maintenance.listCompetitionCampaignProductsByProduct
>["page"][number];

type TryoutAccessCampaignIntegrityPage = Ref.Returns<
  typeof refs.internal.tryoutAccess.queries.internalFunctions.maintenance.getTryoutAccessCampaignIntegrity
>;

type TryoutAccessGrantIntegrityPage = Ref.Returns<
  typeof refs.internal.tryoutAccess.queries.internalFunctions.maintenance.getTryoutAccessGrantIntegrity
>;

type TryoutAccessEntitlementIntegrityPage = Ref.Returns<
  typeof refs.internal.tryoutAccess.queries.internalFunctions.maintenance.getTryoutAccessEntitlementIntegrity
>;

type CompetitionCampaignProductPage = Ref.Returns<
  typeof refs.internal.tryoutAccess.queries.internalFunctions.maintenance.listCompetitionCampaignProductsByProduct
>;

/** Reads the full access campaign integrity snapshot. */
const getTryoutAccessCampaignIntegrity = Effect.fn(
  "tryout.getTryoutAccessCampaignIntegrity"
)(function* (prod: boolean) {
  const config = yield* getConvexConfig({ prod });
  const nowMs = yield* Clock.currentTimeMillis;
  let continueCursor: string | null = null;
  let overdueActiveCampaignCount = 0;
  let overduePendingCompetitionCount = 0;
  let overdueScheduledCampaignCount = 0;

  while (true) {
    const page: TryoutAccessCampaignIntegrityPage = yield* callConvex(
      config,
      "query",
      refs.internal.tryoutAccess.queries.internalFunctions.maintenance
        .getTryoutAccessCampaignIntegrity,
      {
        nowMs,
        paginationOpts: {
          cursor: continueCursor,
          numItems: TRYOUT_ACCESS_PAGE_SIZE,
        },
      }
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
  const nowMs = yield* Clock.currentTimeMillis;
  let continueCursor: string | null = null;
  let overdueActiveGrantCount = 0;

  while (true) {
    const page: TryoutAccessGrantIntegrityPage = yield* callConvex(
      config,
      "query",
      refs.internal.tryoutAccess.queries.internalFunctions.maintenance
        .getTryoutAccessGrantIntegrity,
      {
        nowMs,
        paginationOpts: {
          cursor: continueCursor,
          numItems: TRYOUT_ACCESS_PAGE_SIZE,
        },
      }
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
  const nowMs = yield* Clock.currentTimeMillis;
  let continueCursor: string | null = null;
  let overdueEntitlementCount = 0;

  while (true) {
    const page: TryoutAccessEntitlementIntegrityPage = yield* callConvex(
      config,
      "query",
      refs.internal.tryoutAccess.queries.internalFunctions.maintenance
        .getTryoutAccessEntitlementIntegrity,
      {
        nowMs,
        paginationOpts: {
          cursor: continueCursor,
          numItems: TRYOUT_ACCESS_PAGE_SIZE,
        },
      }
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
    let previousRow: CompetitionCampaignProduct | null = null;

    while (true) {
      const page: CompetitionCampaignProductPage = yield* callConvex(
        config,
        "query",
        refs.internal.tryoutAccess.queries.internalFunctions.maintenance
          .listCompetitionCampaignProductsByProduct,
        {
          product,
          paginationOpts: {
            cursor: continueCursor,
            numItems: TRYOUT_ACCESS_PAGE_SIZE,
          },
        }
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

/** Sweeps overdue access state transitions through the Confect ref. */
const repairTryoutAccess = Effect.fn("tryout.repairAccess")(function* (
  prod: boolean
) {
  const config = yield* getConvexConfig({ prod });

  yield* callConvex(
    config,
    "mutation",
    refs.internal.tryoutAccess.mutations.internalFunctions.status.sweepStates,
    {}
  );

  yield* Effect.sync(() => {
    process.stdout.write(`${JSON.stringify({ repaired: true }, null, 2)}\n`);
  });
});

/** Runs access-state verification or repair for dev or prod. */
const main = Effect.fn("tryout.verifyAccess")(function* () {
  const flags = yield* Effect.sync(() => process.argv.slice(2));
  const prod = flags.includes("--prod");

  if (flags.includes("--repair")) {
    yield* repairTryoutAccess(prod);
    return;
  }

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
