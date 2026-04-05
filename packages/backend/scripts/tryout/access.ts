import * as z from "zod";
import {
  getConvexConfig,
  runConvexQueryWithArgs,
} from "../sync-content/convexApi";
import { loadEnvFile } from "../sync-content/runtime";

const TRYOUT_ACCESS_PAGE_SIZE = 100;

const tryoutAccessCampaignIntegrityPageSchema = z.object({
  continueCursor: z.string(),
  isDone: z.boolean(),
  overdueActiveCampaignCount: z.number(),
  overduePendingCompetitionCount: z.number(),
  overdueScheduledCampaignCount: z.number(),
  stuckFinalizingCompetitionCount: z.number(),
});

const tryoutAccessGrantIntegrityPageSchema = z.object({
  continueCursor: z.string(),
  isDone: z.boolean(),
  overdueActiveGrantCount: z.number(),
});

type TryoutAccessCampaignIntegrityPage = z.infer<
  typeof tryoutAccessCampaignIntegrityPageSchema
>;
type TryoutAccessGrantIntegrityPage = z.infer<
  typeof tryoutAccessGrantIntegrityPageSchema
>;

/** Reads the full access campaign integrity snapshot. */
async function getTryoutAccessCampaignIntegrity(prod: boolean) {
  const config = getConvexConfig({ prod });
  const nowMs = Date.now();
  let continueCursor: string | null = null;
  let overdueActiveCampaignCount = 0;
  let overduePendingCompetitionCount = 0;
  let overdueScheduledCampaignCount = 0;
  let stuckFinalizingCompetitionCount = 0;

  while (true) {
    const page: TryoutAccessCampaignIntegrityPage =
      await runConvexQueryWithArgs(
        config,
        "tryoutAccess/queries/internal/maintenance:getTryoutAccessCampaignIntegrity",
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
    stuckFinalizingCompetitionCount += page.stuckFinalizingCompetitionCount;

    if (page.isDone) {
      return {
        overdueActiveCampaignCount,
        overduePendingCompetitionCount,
        overdueScheduledCampaignCount,
        stuckFinalizingCompetitionCount,
      };
    }

    continueCursor = page.continueCursor;
  }
}

/** Reads the full access grant integrity snapshot. */
async function getTryoutAccessGrantIntegrity(prod: boolean) {
  const config = getConvexConfig({ prod });
  const nowMs = Date.now();
  let continueCursor: string | null = null;
  let overdueActiveGrantCount = 0;

  while (true) {
    const page: TryoutAccessGrantIntegrityPage = await runConvexQueryWithArgs(
      config,
      "tryoutAccess/queries/internal/maintenance:getTryoutAccessGrantIntegrity",
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
}

/** Runs access-state verification for dev or prod. */
async function main() {
  loadEnvFile();

  const flags = process.argv.slice(2);
  const prod = flags.includes("--prod");
  const [campaigns, grants] = await Promise.all([
    getTryoutAccessCampaignIntegrity(prod),
    getTryoutAccessGrantIntegrity(prod),
  ]);
  const result = {
    ...campaigns,
    ...grants,
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode =
    result.overdueScheduledCampaignCount > 0 ||
    result.overdueActiveCampaignCount > 0 ||
    result.overduePendingCompetitionCount > 0 ||
    result.stuckFinalizingCompetitionCount > 0 ||
    result.overdueActiveGrantCount > 0
      ? 1
      : 0;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
