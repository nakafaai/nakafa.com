import {
  AUDITED_AUDIO_WORKFLOW_COUNT,
  AUDITED_AUDIO_WORKFLOW_FAILURE_COUNT,
  AUDITED_AUDIO_WORKFLOW_STEP_COUNT,
  AUDITED_AUDIO_WORKFLOW_SUCCESS_COUNT,
} from "@repo/backend/convex/contentRelease/cutover/inventory";
import type { audioWorkflowAuditValidator } from "@repo/backend/convex/contentRelease/cutover/schema";
import {
  type ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import type { Infer } from "convex/values";
import { Context, Effect } from "effect";

const AUDIO_WORKFLOW_CLEANUP_BATCH_SIZE = 8;

export type AudioWorkflowAudit = Infer<typeof audioWorkflowAuditValidator>;

export interface AudioWorkflowRecord {
  readonly id: string;
  readonly result: "canceled" | "failed" | "running" | "success";
  readonly steps: number;
}

export interface AudioWorkflowInspection {
  readonly activeScheduledNames: readonly string[];
  readonly workflows: readonly AudioWorkflowRecord[];
}

export interface AudioWorkflowCheckpoint {
  readonly audit?: AudioWorkflowAudit;
  readonly auditedAt?: number;
  readonly cleanedAt?: number;
}

interface AudioWorkflowAuditReceipt extends AudioWorkflowAudit {
  readonly complete: true;
}

export interface AudioWorkflowJournalService {
  readonly cleanup: (
    workflowId: string
  ) => Effect.Effect<boolean, ReleaseError>;
  readonly inspect: () => Effect.Effect<AudioWorkflowInspection, ReleaseError>;
  readonly readCheckpoint: () => Effect.Effect<
    AudioWorkflowCheckpoint,
    ReleaseError
  >;
  readonly recordAudit: (
    audit: AudioWorkflowAudit
  ) => Effect.Effect<null, ReleaseError>;
  readonly recordCleanup: () => Effect.Effect<null, ReleaseError>;
}

/** External component and checkpoint operations for the audio journal cutover. */
export class AudioWorkflowJournal extends Context.Tag(
  "@repo/backend/contentRelease/AudioWorkflowJournal"
)<AudioWorkflowJournal, AudioWorkflowJournalService>() {}

/** Records the exact terminal production journal before any cleanup. */
export const auditAudioWorkflowJournal = Effect.fn(
  "contentRelease.cutover.auditAudioWorkflowJournal"
)(function* () {
  const journal = yield* AudioWorkflowJournal;
  const inspection = yield* journal.inspect();
  yield* requireNoScheduledAudio(inspection.activeScheduledNames);
  const audit = yield* makeExactAudioAudit(inspection.workflows);
  yield* journal.recordAudit(audit);
  return completeAudioAudit(audit);
});

/** Cleans one retry-safe batch from the frozen terminal journal. */
export const cleanupAudioWorkflowJournal = Effect.fn(
  "contentRelease.cutover.cleanupAudioWorkflowJournal"
)(function* () {
  const journal = yield* AudioWorkflowJournal;
  const checkpoint = yield* journal.readCheckpoint();
  const audit = checkpoint.audit;
  if (!audit) {
    return yield* journalFailure(
      "The terminal audio workflow inventory has not been audited."
    );
  }
  const inspection = yield* journal.inspect();
  yield* requireNoScheduledAudio(inspection.activeScheduledNames);
  yield* validateRemainingAudioWorkflows(inspection.workflows, audit);
  if (inspection.workflows.length === 0) {
    yield* journal.recordCleanup();
    const complete = true;
    return {
      cleaned: 0,
      complete,
      remainingSteps: 0,
      remainingWorkflows: 0,
    };
  }
  const batch = inspection.workflows.slice(
    0,
    AUDIO_WORKFLOW_CLEANUP_BATCH_SIZE
  );
  const workflowCount = inspection.workflows.length;
  const workflowSteps = inspection.workflows.reduce(
    (total, row) => total + row.steps,
    0
  );
  const cleaned = yield* Effect.forEach(
    batch,
    ({ id }) => journal.cleanup(id),
    { concurrency: 1 }
  );
  if (cleaned.some((result) => !result)) {
    return yield* journalFailure(
      "A frozen terminal audio workflow disappeared during cleanup."
    );
  }
  const cleanedSteps = batch.reduce((total, row) => total + row.steps, 0);
  const complete = false;
  return {
    cleaned: cleaned.length,
    complete,
    remainingSteps: workflowSteps - cleanedSteps,
    remainingWorkflows: workflowCount - cleaned.length,
  };
});

/** Requires the exact accepted audio journal marker before legacy drain. */
export const requireAudioWorkflowCleanupCheckpoint = Effect.fn(
  "contentRelease.cutover.requireAudioWorkflowCleanupCheckpoint"
)(function* (checkpoint: AudioWorkflowCheckpoint) {
  const audit = checkpoint.audit;
  if (
    !audit ||
    checkpoint.auditedAt === undefined ||
    checkpoint.cleanedAt === undefined
  ) {
    return yield* journalFailure(
      "The terminal audio workflow journal has not been cleaned."
    );
  }
  yield* validateAudioWorkflowAudit(audit);
});

/** Builds the only accepted production audit from terminal component rows. */
const makeExactAudioAudit = Effect.fn(
  "contentRelease.cutover.makeExactAudioAudit"
)(function* (workflows: readonly AudioWorkflowRecord[]) {
  const terminal = yield* Effect.forEach(
    workflows,
    normalizeTerminalAudioWorkflow
  );
  terminal.sort((left, right) => left.id.localeCompare(right.id));
  const ids = new Set(terminal.map(({ id }) => id));
  if (ids.size !== terminal.length) {
    return yield* journalFailure(
      "The audio workflow journal contains duplicate workflow identities."
    );
  }
  const audit: AudioWorkflowAudit = {
    failed: terminal.filter(({ result }) => result === "failed").length,
    steps: terminal.reduce((total, row) => total + row.steps, 0),
    succeeded: terminal.filter(({ result }) => result === "success").length,
    total: terminal.length,
    workflows: terminal.map(({ id, result, steps }) => ({
      id,
      result,
      steps,
    })),
  };
  yield* validateAudioWorkflowAudit(audit);
  return audit;
});

/** Narrows one audited row to its exact terminal storage shape. */
const normalizeTerminalAudioWorkflow = Effect.fn(
  "contentRelease.cutover.normalizeTerminalAudioWorkflow"
)(function* ({ id, result, steps }: AudioWorkflowRecord) {
  if (
    id.length === 0 ||
    id.trim() !== id ||
    (result !== "failed" && result !== "success") ||
    !Number.isSafeInteger(steps) ||
    steps < 0 ||
    steps > 256
  ) {
    return yield* journalFailure(
      "The audio workflow journal contains a nonterminal or oversized entry."
    );
  }
  return { id, result, steps };
});

/** Rejects new, changed, or nonterminal rows after the frozen audit. */
const validateRemainingAudioWorkflows = Effect.fn(
  "contentRelease.cutover.validateRemainingAudioWorkflows"
)(function* (
  workflows: readonly AudioWorkflowRecord[],
  audit: AudioWorkflowAudit
) {
  yield* validateAudioWorkflowAudit(audit);
  const expected = new Map(audit.workflows.map((row) => [row.id, row]));
  for (const workflow of workflows) {
    const accepted = expected.get(workflow.id);
    if (
      !accepted ||
      accepted.result !== workflow.result ||
      accepted.steps !== workflow.steps
    ) {
      return yield* journalFailure(
        "The remaining audio workflow journal differs from its frozen audit."
      );
    }
  }
});

/** Proves the persisted audit still matches the exact production inventory. */
export const validateAudioWorkflowAudit = Effect.fn(
  "contentRelease.cutover.validateAudioWorkflowAudit"
)(function* (audit: AudioWorkflowAudit) {
  const workflows = yield* Effect.forEach(
    audit.workflows,
    normalizeTerminalAudioWorkflow
  );
  const identities = new Set(workflows.map(({ id }) => id));
  if (identities.size !== workflows.length) {
    return yield* journalFailure(
      "The persisted audio workflow audit contains duplicate identities."
    );
  }
  const sorted = workflows.every((workflow, index) => {
    if (index === 0) {
      return true;
    }
    const previous = workflows.at(index - 1);
    return previous !== undefined && previous.id.localeCompare(workflow.id) < 0;
  });
  if (!sorted) {
    return yield* journalFailure(
      "The persisted audio workflow audit is not in canonical identity order."
    );
  }
  const succeeded = workflows.filter(
    ({ result }) => result === "success"
  ).length;
  const failed = workflows.filter(({ result }) => result === "failed").length;
  const steps = workflows.reduce((total, row) => total + row.steps, 0);
  if (
    audit.total !== workflows.length ||
    audit.succeeded !== succeeded ||
    audit.failed !== failed ||
    audit.steps !== steps ||
    audit.total !== AUDITED_AUDIO_WORKFLOW_COUNT ||
    audit.succeeded !== AUDITED_AUDIO_WORKFLOW_SUCCESS_COUNT ||
    audit.failed !== AUDITED_AUDIO_WORKFLOW_FAILURE_COUNT ||
    audit.steps !== AUDITED_AUDIO_WORKFLOW_STEP_COUNT ||
    workflows.length !== AUDITED_AUDIO_WORKFLOW_COUNT
  ) {
    return yield* journalFailure(
      "The audio workflow journal differs from the production inventory."
    );
  }
});

/** Rejects deployment while an old audio function can still execute. */
const requireNoScheduledAudio = Effect.fn(
  "contentRelease.cutover.requireNoScheduledAudio"
)(function* (names: readonly string[]) {
  if (names.length !== 0) {
    return yield* journalFailure(
      `Scheduled audio functions remain active: ${names.join(", ")}.`
    );
  }
});

function journalFailure(message: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Audio workflow cutover: ${message}`
  );
}

function completeAudioAudit(
  audit: AudioWorkflowAudit
): AudioWorkflowAuditReceipt {
  return { ...audit, complete: true };
}
