import * as z from "zod";
import {
  getConvexConfig,
  runConvexQueryWithArgs,
} from "./sync-content/convexApi";
import { loadEnvFile } from "./sync-content/runtime";

const IRT_VERIFY_PAGE_SIZE = 500;

const calibrationCacheIntegrityPageSchema = z.object({
  continueCursor: z.string(),
  isDone: z.boolean(),
  missingStatsSetCount: z.number(),
  oversizedSetCount: z.number(),
});

const scaleQualityIntegrityPageSchema = z.object({
  continueCursor: z.string(),
  isDone: z.boolean(),
  missingQualityCheckTryoutCount: z.number(),
  unstartableTryoutCount: z.number(),
});

type CalibrationCacheIntegrityPage = z.infer<
  typeof calibrationCacheIntegrityPageSchema
>;
type ScaleQualityIntegrityPage = z.infer<
  typeof scaleQualityIntegrityPageSchema
>;

async function getCalibrationCacheIntegrity(prod: boolean) {
  const config = getConvexConfig({ prod });
  let continueCursor: string | null = null;
  let missingStatsSetCount = 0;
  let oversizedSetCount = 0;

  while (true) {
    const page: CalibrationCacheIntegrityPage = await runConvexQueryWithArgs(
      config,
      "irt/queries/internal/maintenance:getCalibrationCacheIntegrity",
      {
        paginationOpts: {
          cursor: continueCursor,
          numItems: IRT_VERIFY_PAGE_SIZE,
        },
      },
      calibrationCacheIntegrityPageSchema
    );

    missingStatsSetCount += page.missingStatsSetCount;
    oversizedSetCount += page.oversizedSetCount;

    if (page.isDone) {
      return {
        missingStatsSetCount,
        oversizedSetCount,
      };
    }

    continueCursor = page.continueCursor;
  }
}

async function getScaleQualityIntegrity(prod: boolean) {
  const config = getConvexConfig({ prod });
  let continueCursor: string | null = null;
  let missingQualityCheckTryoutCount = 0;
  let unstartableTryoutCount = 0;

  while (true) {
    const page: ScaleQualityIntegrityPage = await runConvexQueryWithArgs(
      config,
      "irt/queries/internal/maintenance:getScaleQualityIntegrity",
      {
        paginationOpts: {
          cursor: continueCursor,
          numItems: IRT_VERIFY_PAGE_SIZE,
        },
      },
      scaleQualityIntegrityPageSchema
    );

    missingQualityCheckTryoutCount += page.missingQualityCheckTryoutCount;
    unstartableTryoutCount += page.unstartableTryoutCount;

    if (page.isDone) {
      return {
        missingQualityCheckTryoutCount,
        unstartableTryoutCount,
      };
    }

    continueCursor = page.continueCursor;
  }
}

async function main() {
  loadEnvFile();

  const [kind, ...flags] = process.argv.slice(2);
  const prod = flags.includes("--prod");

  if (!(kind === "cache" || kind === "scale")) {
    throw new Error("Usage: tsx scripts/irt-verify.ts <cache|scale> [--prod]");
  }

  const result =
    kind === "cache"
      ? await getCalibrationCacheIntegrity(prod)
      : await getScaleQualityIntegrity(prod);

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
