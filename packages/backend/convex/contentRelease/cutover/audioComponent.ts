import { components } from "@repo/backend/convex/_generated/api";
import type {
  ActionCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import type {
  AudioWorkflowAudit,
  AudioWorkflowJournalService,
  AudioWorkflowRecord,
} from "@repo/backend/convex/contentRelease/cutover/audioJournal";
import { AUDITED_AUDIO_WORKFLOW_NAME } from "@repo/backend/convex/contentRelease/cutover/inventory";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { workflow } from "@repo/backend/convex/workflow";
import {
  makeFunctionReference,
  type PaginationOptions,
  paginationOptsValidator,
} from "convex/server";
import { v } from "convex/values";
import { Effect } from "effect";

const AUDIO_SCHEDULE_PAGE_SIZE = 128;
const AUDIO_WORKFLOW_PAGE_SIZE = 100;
const AUDIO_WORKFLOW_STEP_PAGE_SIZE = 256;

const scheduledPageValidator = v.object({
  activeNames: v.array(v.string()),
  cursor: v.string(),
  done: v.boolean(),
});
const checkpointReference = makeFunctionReference<
  "query",
  Record<string, never>,
  {
    audit?: AudioWorkflowAudit;
    auditedAt?: number;
    cleanedAt?: number;
  }
>("contentRelease/cutover/audio:checkpoint");
const recordAuditReference = makeFunctionReference<
  "mutation",
  { audit: AudioWorkflowAudit },
  null
>("contentRelease/cutover/audio:recordAudit");
const recordCleanupReference = makeFunctionReference<
  "mutation",
  Record<string, never>,
  null
>("contentRelease/cutover/audio:recordCleanup");
const scheduledPageReference = makeFunctionReference<
  "query",
  { paginationOpts: PaginationOptions },
  { activeNames: string[]; cursor: string; done: boolean }
>("contentRelease/cutover/audioComponent:scheduledPage");

/** Reads one bounded system-scheduler page without returning job arguments. */
export const scheduledPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: scheduledPageValidator,
  handler: (ctx, args) =>
    runConvexProgram(readScheduledAudioPage(ctx, args.paginationOpts)),
});

/** Binds journal programs to the Workflow component and app checkpoint. */
export function makeLiveAudioJournal(
  ctx: ActionCtx
): AudioWorkflowJournalService {
  return {
    cleanup: (workflowId) =>
      callInternal(() =>
        ctx.runMutation(components.workflow.workflow.cleanup, { workflowId })
      ),
    inspect: () => inspectAudioWorkflowJournal(ctx),
    readCheckpoint: () =>
      callInternal(() => ctx.runQuery(checkpointReference, {})),
    recordAudit: (auditReceipt) =>
      callInternal(() =>
        ctx.runMutation(recordAuditReference, { audit: auditReceipt })
      ),
    recordCleanup: () =>
      callInternal(() => ctx.runMutation(recordCleanupReference, {})),
  };
}

/** Loads exact component rows and every bounded linked step count. */
const inspectAudioWorkflowJournal = Effect.fn(
  "contentRelease.cutover.inspectAudioWorkflowJournal"
)(function* (ctx: ActionCtx) {
  const page = yield* callInternal(() =>
    workflow.listByName(ctx, AUDITED_AUDIO_WORKFLOW_NAME, {
      paginationOpts: { cursor: null, numItems: AUDIO_WORKFLOW_PAGE_SIZE },
    })
  );
  if (!page.isDone) {
    return yield* audioFailure(
      "The audio workflow journal exceeds its audited page."
    );
  }
  const workflows = yield* Effect.forEach(
    page.page,
    (stored) =>
      callInternal(() =>
        workflow.listSteps(ctx, stored.workflowId, {
          paginationOpts: {
            cursor: null,
            numItems: AUDIO_WORKFLOW_STEP_PAGE_SIZE,
          },
        })
      ).pipe(
        Effect.flatMap((steps) => {
          if (!steps.isDone) {
            return audioFailure(
              `Workflow ${stored.workflowId} exceeds its audited step page.`
            );
          }
          return Effect.succeed({
            id: stored.workflowId,
            result: readAudioWorkflowResult(stored.runResult),
            steps: steps.page.length,
          });
        })
      ),
    { concurrency: 4 }
  );
  const activeScheduledNames = yield* scanScheduledAudio(ctx);
  return { activeScheduledNames, workflows };
});

/** Scans all scheduler pages for an active deleted audio function. */
const scanScheduledAudio = Effect.fn(
  "contentRelease.cutover.scanScheduledAudio"
)(function* (ctx: ActionCtx) {
  const activeNames: string[] = [];
  let cursor: null | string = null;
  while (true) {
    const page = yield* callInternal(() =>
      ctx.runQuery(scheduledPageReference, {
        paginationOpts: {
          cursor,
          numItems: AUDIO_SCHEDULE_PAGE_SIZE,
        },
      })
    );
    activeNames.push(...page.activeNames);
    if (page.done) {
      activeNames.sort();
      return activeNames;
    }
    cursor = page.cursor;
  }
});

/** Filters one system page down to active audio-owned function names. */
const readScheduledAudioPage = Effect.fn(
  "contentRelease.cutover.readScheduledAudioPage"
)(function* (ctx: QueryCtx, paginationOpts: PaginationOptions) {
  const page = yield* Effect.promise(() =>
    ctx.db.system.query("_scheduled_functions").paginate(paginationOpts)
  );
  return {
    activeNames: page.page
      .filter(
        ({ name, state }) =>
          isAudioFunction(name) &&
          (state.kind === "pending" || state.kind === "inProgress")
      )
      .map(({ name }) => name),
    cursor: page.continueCursor,
    done: page.isDone,
  };
});

function isAudioFunction(name: string) {
  return (
    name.startsWith("audioStudies/") ||
    name === "contents/actions/queue:populateAudioQueue" ||
    name.startsWith("contents/mutations/audio:") ||
    name.startsWith("contents/queries/audio:")
  );
}

function readAudioWorkflowResult(
  result:
    | { readonly error: string; readonly kind: "failed" }
    | { readonly kind: "canceled" }
    | { readonly kind: "success"; readonly returnValue: unknown }
    | undefined
): AudioWorkflowRecord["result"] {
  return result?.kind ?? "running";
}

function audioFailure(message: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Audio workflow cutover: ${message}`
  );
}
