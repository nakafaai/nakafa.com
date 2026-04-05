import * as z from "zod";
import {
  getConvexConfig,
  runConvexMutationGeneric,
  runConvexQueryWithArgs,
} from "../sync-content/convexApi";
import { loadEnvFile } from "../sync-content/runtime";

const TRYOUT_CONTROL_PAGE_SIZE = 100;

const tryoutControlIntegrityPageSchema = z.object({
  continueCursor: z.string(),
  duplicateControlUserCount: z.number(),
  isDone: z.boolean(),
  missingControlUserCount: z.number(),
  userIdsNeedingRepair: z.array(z.string()),
  usersScanned: z.number(),
});

const tryoutControlRepairResultSchema = z.object({
  controlId: z.string().nullable(),
  controlsCreated: z.number(),
  duplicatesDeleted: z.number(),
  hasMoreDuplicates: z.boolean(),
});

type TryoutControlIntegrityPage = z.infer<
  typeof tryoutControlIntegrityPageSchema
>;
type TryoutControlRepairResult = z.infer<
  typeof tryoutControlRepairResultSchema
>;

/** Reads one bounded page of user-control integrity totals. */
async function getTryoutControlIntegrityPage(
  prod: boolean,
  cursor: string | null
) {
  const config = getConvexConfig({ prod });

  return await runConvexQueryWithArgs(
    config,
    "tryouts/queries/internal/maintenance:getUserTryoutControlIntegrity",
    {
      paginationOpts: {
        cursor,
        numItems: TRYOUT_CONTROL_PAGE_SIZE,
      },
    },
    tryoutControlIntegrityPageSchema
  );
}

/** Repairs one user until no duplicate control rows remain. */
async function repairUserTryoutControl(
  prod: boolean,
  userId: string
): Promise<TryoutControlRepairResult> {
  const config = getConvexConfig({ prod });
  let totals: TryoutControlRepairResult = {
    controlId: null,
    controlsCreated: 0,
    duplicatesDeleted: 0,
    hasMoreDuplicates: false,
  };

  while (true) {
    const result = await runConvexMutationGeneric(
      config,
      "tryouts/mutations/internal/controls:repairOneUserTryoutControl",
      {
        updatedAt: Date.now(),
        userId,
      },
      tryoutControlRepairResultSchema
    );

    totals = {
      controlId: result.controlId ?? totals.controlId,
      controlsCreated: totals.controlsCreated + result.controlsCreated,
      duplicatesDeleted: totals.duplicatesDeleted + result.duplicatesDeleted,
      hasMoreDuplicates: result.hasMoreDuplicates,
    };

    if (!result.hasMoreDuplicates) {
      return totals;
    }
  }
}

/** Aggregates the full integrity snapshot across every page of users. */
async function verifyTryoutControls(prod: boolean) {
  let continueCursor: string | null = null;
  let duplicateControlUserCount = 0;
  let missingControlUserCount = 0;
  let usersScanned = 0;

  while (true) {
    const page = await getTryoutControlIntegrityPage(prod, continueCursor);

    duplicateControlUserCount += page.duplicateControlUserCount;
    missingControlUserCount += page.missingControlUserCount;
    usersScanned += page.usersScanned;

    if (page.isDone) {
      return {
        duplicateControlUserCount,
        missingControlUserCount,
        usersScanned,
      };
    }

    continueCursor = page.continueCursor;
  }
}

/** Repairs every user page that still violates the control-row invariants. */
async function repairTryoutControls(prod: boolean) {
  let continueCursor: string | null = null;
  let controlsCreated = 0;
  let duplicatesDeleted = 0;
  let repairedUserCount = 0;
  let usersScanned = 0;

  while (true) {
    const page: TryoutControlIntegrityPage =
      await getTryoutControlIntegrityPage(prod, continueCursor);

    usersScanned += page.usersScanned;

    for (const userId of page.userIdsNeedingRepair) {
      const repair = await repairUserTryoutControl(prod, userId);

      controlsCreated += repair.controlsCreated;
      duplicatesDeleted += repair.duplicatesDeleted;
      repairedUserCount += 1;
    }

    if (page.isDone) {
      return {
        controlsCreated,
        duplicatesDeleted,
        repairedUserCount,
        usersScanned,
      };
    }

    continueCursor = page.continueCursor;
  }
}

/** Runs the requested verify or repair workflow for tryout controls. */
async function main() {
  loadEnvFile();

  const [command, ...flags] = process.argv.slice(2);
  const prod = flags.includes("--prod");

  if (!(command === "verify" || command === "repair")) {
    throw new Error(
      "Usage: tsx scripts/tryout/controls.ts <verify|repair> [--prod]"
    );
  }

  if (command === "verify") {
    const result = await verifyTryoutControls(prod);

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode =
      result.missingControlUserCount > 0 || result.duplicateControlUserCount > 0
        ? 1
        : 0;
    return;
  }

  const repairResult = await repairTryoutControls(prod);
  const verifyResult = await verifyTryoutControls(prod);

  process.stdout.write(
    `${JSON.stringify({ repairResult, verifyResult }, null, 2)}\n`
  );
  process.exitCode =
    verifyResult.missingControlUserCount > 0 ||
    verifyResult.duplicateControlUserCount > 0
      ? 1
      : 0;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
