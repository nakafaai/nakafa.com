import {
  type AudioWorkflowAudit,
  AudioWorkflowJournal,
  type AudioWorkflowJournalService,
  type AudioWorkflowRecord,
  auditAudioWorkflowJournal,
  cleanupAudioWorkflowJournal,
} from "@repo/backend/convex/contentRelease/cutover/audioJournal";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/cutover/audioJournal", () => {
  it("records the exact terminal production journal", async () => {
    const records = makeProductionRecords();
    let recorded: AudioWorkflowAudit | undefined;
    const service = makeJournalService(records, {
      recordAudit: (audit) => {
        recorded = audit;
      },
    });

    await expect(
      Effect.runPromise(
        auditAudioWorkflowJournal().pipe(
          Effect.provideService(AudioWorkflowJournal, service)
        )
      )
    ).resolves.toMatchObject({
      complete: true,
      failed: 26,
      steps: 315,
      succeeded: 37,
      total: 63,
    });
    expect(recorded?.workflows).toHaveLength(63);
    expect(recorded?.workflows.at(0)).toEqual({
      id: "audio-workflow-000",
      result: "success",
      steps: 5,
    });
  });

  it("rejects active scheduled audio and nonterminal journal rows", async () => {
    const scheduled = makeJournalService(makeProductionRecords(), {
      activeScheduledNames: [
        "audioStudies/mutations/queue:startWorkflowsForPendingItems",
      ],
    });
    await expect(
      Effect.runPromise(
        auditAudioWorkflowJournal().pipe(
          Effect.provideService(AudioWorkflowJournal, scheduled)
        )
      )
    ).rejects.toMatchObject({
      message: expect.stringContaining("Scheduled audio functions remain"),
    });

    const runningRecords = makeProductionRecords();
    runningRecords[0] = { ...runningRecords[0], result: "running" };
    await expect(
      Effect.runPromise(
        auditAudioWorkflowJournal().pipe(
          Effect.provideService(
            AudioWorkflowJournal,
            makeJournalService(runningRecords)
          )
        )
      )
    ).rejects.toMatchObject({
      message: expect.stringContaining("nonterminal"),
    });
  });

  it("cleans only the frozen set in retry-safe bounded batches", async () => {
    const remaining = makeProductionRecords();
    const cleaned: string[] = [];
    let completed = 0;
    const audit = makeProductionAudit();
    const service = makeJournalService(remaining, {
      audit,
      cleanup: (workflowId) => {
        const index = remaining.findIndex(({ id }) => id === workflowId);
        if (index === -1) {
          return false;
        }
        remaining.splice(index, 1);
        cleaned.push(workflowId);
        return true;
      },
      recordCleanup: () => {
        completed += 1;
      },
    });

    const runCleanup = () =>
      Effect.runPromise(
        cleanupAudioWorkflowJournal().pipe(
          Effect.provideService(AudioWorkflowJournal, service)
        )
      );
    await expect(runCleanup()).resolves.toEqual({
      cleaned: 8,
      complete: false,
      remainingSteps: 275,
      remainingWorkflows: 55,
    });
    while (remaining.length > 0) {
      await runCleanup();
    }
    await expect(runCleanup()).resolves.toEqual({
      cleaned: 0,
      complete: true,
      remainingSteps: 0,
      remainingWorkflows: 0,
    });
    expect(cleaned).toHaveLength(63);
    expect(completed).toBe(1);
  });

  it("rejects a workflow that was not present in the frozen audit", async () => {
    const records = makeProductionRecords();
    records.push({ id: "new-audio-workflow", result: "success", steps: 1 });
    const service = makeJournalService(records, {
      audit: makeProductionAudit(),
    });

    await expect(
      Effect.runPromise(
        cleanupAudioWorkflowJournal().pipe(
          Effect.provideService(AudioWorkflowJournal, service)
        )
      )
    ).rejects.toMatchObject({
      message: expect.stringContaining("differs from its frozen audit"),
    });
  });
});

function makeJournalService(
  records: AudioWorkflowRecord[],
  overrides: {
    activeScheduledNames?: string[];
    audit?: AudioWorkflowAudit;
    cleanup?: (workflowId: string) => boolean;
    recordAudit?: (audit: AudioWorkflowAudit) => void;
    recordCleanup?: () => void;
  } = {}
) {
  return {
    cleanup: (workflowId) =>
      Effect.sync(() => overrides.cleanup?.(workflowId) ?? true),
    inspect: () =>
      Effect.succeed({
        activeScheduledNames: overrides.activeScheduledNames ?? [],
        workflows: records,
      }),
    readCheckpoint: () => Effect.succeed({ audit: overrides.audit }),
    recordAudit: (audit) =>
      Effect.sync(() => {
        overrides.recordAudit?.(audit);
        return null;
      }),
    recordCleanup: () =>
      Effect.sync(() => {
        overrides.recordCleanup?.();
        return null;
      }),
  } satisfies AudioWorkflowJournalService;
}

function makeProductionRecords(): AudioWorkflowRecord[] {
  return Array.from({ length: 63 }, (_, index) => ({
    id: `audio-workflow-${index.toString().padStart(3, "0")}`,
    result: index < 37 ? "success" : "failed",
    steps: 5,
  }));
}

function makeProductionAudit(): AudioWorkflowAudit {
  const workflows = makeProductionRecords().map(({ id, result, steps }) => {
    if (result === "canceled" || result === "running") {
      throw new Error("Test fixture must contain only terminal workflows.");
    }
    return { id, result, steps };
  });
  return {
    failed: 26,
    steps: 315,
    succeeded: 37,
    total: 63,
    workflows,
  };
}
