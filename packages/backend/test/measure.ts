import type { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import type {
  ActionCtx,
  MutationCtx,
} from "@repo/backend/convex/_generated/server";
import { getFunctionAddress } from "convex/server";
import { Array as Arr } from "effect";

type MeasuredTest = ReturnType<typeof createConvexTestWithBetterAuth>;

/** What an action can run in a transaction of its own: a query or a mutation. */
type Runnable =
  | Parameters<ActionCtx["runQuery"]>[0]
  | Parameters<ActionCtx["runMutation"]>[0];

/** The name of a function of the app, or the path of a function of a component. */
function nameOf(reference: Runnable) {
  const address = getFunctionAddress(reference);
  return address.reference ?? address.functionHandle ?? String(address.name);
}

/** What one transaction read and wrote, with the name of the function that ran it. */
function sampleOf(
  name: string,
  metrics: Awaited<ReturnType<MutationCtx["meta"]["getTransactionMetrics"]>>
) {
  return {
    bytesRead: metrics.bytesRead.used,
    bytesWritten: metrics.bytesWritten.used,
    documentsRead: metrics.documentsRead.used,
    documentsWritten: metrics.documentsWritten.used,
    name,
  };
}
export type Sample = ReturnType<typeof sampleOf>;

/** Adds the reads and writes of samples up. */
export function totalOf(samples: readonly Sample[]) {
  return Arr.reduce(
    samples,
    { bytesRead: 0, bytesWritten: 0, documentsRead: 0, documentsWritten: 0 },
    (total, sample) => ({
      bytesRead: total.bytesRead + sample.bytesRead,
      bytesWritten: total.bytesWritten + sample.bytesWritten,
      documentsRead: total.documentsRead + sample.documentsRead,
      documentsWritten: total.documentsWritten + sample.documentsWritten,
    })
  );
}

/**
 * Gives an action the means to run its queries and mutations as separate
 * transactions of a test deployment, each measured, as the deployment runs
 * them, and hands each measure to `observe`.
 */
export function measured(
  t: MeasuredTest,
  ctx: ActionCtx,
  observe: (sample: Sample) => void
): ActionCtx {
  return {
    ...ctx,
    runMutation: (mutation, ...args) =>
      t.mutation(async (mutationCtx) => {
        const value = await mutationCtx.runMutation(mutation, ...args);
        observe(
          sampleOf(
            nameOf(mutation),
            await mutationCtx.meta.getTransactionMetrics()
          )
        );
        return value;
      }),
    runQuery: (query, ...args) =>
      t.query(async (queryCtx) => {
        const value = await queryCtx.runQuery(query, ...args);
        observe(
          sampleOf(nameOf(query), await queryCtx.meta.getTransactionMetrics())
        );
        return value;
      }),
  };
}
