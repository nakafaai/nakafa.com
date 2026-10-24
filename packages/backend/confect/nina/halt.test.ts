import { Ref } from "@confect/core";
import { QueryRunner } from "@confect/server";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import { turnHalted, watchHalt } from "@repo/backend/confect/nina/halt";
import { readThread } from "@repo/backend/confect/nina/sealed/thread";
import { SealedReadError } from "@repo/backend/confect/nina/sealed.spec";
import { provider } from "@repo/backend/test/gateway";
import { createNinaTest, ninaModel } from "@repo/backend/test/nina";
import { args, contextFor, start } from "@repo/backend/test/nina/admission";
import { stubReport } from "@repo/backend/test/nina/report";
import { createSilentTest, hasAnswer } from "@repo/backend/test/nina/silent";
import { encodeJsonText } from "@repo/utilities/json";
import {
  Array as Arr,
  Effect,
  Layer,
  Logger,
  MutableRef,
  Schema,
} from "effect";
import { TestClock } from "effect/testing";

vi.mock("@repo/backend/confect/nina/sealed/thread", async (load) => {
  const actual =
    await load<typeof import("@repo/backend/confect/nina/sealed/thread")>();
  return { ...actual, readThread: vi.fn(actual.readThread) };
});
vi.mock("@repo/backend/confect/gateway/live", async () => ({
  GatewayLive: (await import("@repo/backend/test/gateway")).GatewayTest,
}));

// Admission freezes the page facts of a prompt; the stop and resend test needs
// no signed content for them.
vi.mock("@repo/backend/confect/nina/context", () => ({
  resolveNinaContext: vi.fn(),
}));

const run = Ref.getFunctionReference(refs.internal.nina.response.run);
const cancel = Ref.getFunctionReference(refs.public.nina.lifecycle.cancel);

describe("A running Nina turn that the learner stops", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    provider.languageModel.mockReset();
  });

  it("answers the turn sent right after a stop while the stopped run still winds down, and the late exit changes nothing", async () => {
    vi.mocked(resolveNinaContext).mockReturnValue(contextFor("home"));
    const f = await createSilentTest();
    try {
      const { running } = await f.begin();
      await f.owner.mutation(cancel, { chatId: f.chatId });

      // The next prompt settles the stopped turn and queues its own, and that
      // turn's run needs neither the stopped run to end nor a sweep.
      provider.languageModel.mockReturnValue(ninaModel());
      const next = Ref.decodeReturnsSync(
        refs.public.nina.turns.start,
        await f.owner.mutation(start, {
          ...args,
          chatId: f.chatId,
          requestId: "next",
        })
      );
      await f.t.action(run, { turnId: next.turnId });
      const answered = await f.t.query((ctx) =>
        ctx.db.get("ninaTurns", next.turnId)
      );
      expect(answered?.state.status).toBe("complete");

      // The stopped run exits later and finds its turn settled.
      f.release();
      await running;
      const state = await f.inspect();
      expect(state.turn?.state.status).toBe("cancelled");
      expect(state.chat?.activeTurnId).toBeUndefined();
      expect(state.user?.credits).toBe(0);
      expect(
        Arr.filter(state.ledger, (row) => row.type === "refund")
      ).toHaveLength(1);
    } finally {
      f.release();
    }
  }, 30_000);

  // The run asks about its turn every two seconds (`HALT_POLL` in `halt.ts`), so
  // these tests wait in real time and get a longer limit than the default.
  it("stops a silent provider call when the learner cancels, and pays back only after the run exits", async () => {
    const report = stubReport();
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const f = await createSilentTest();
    try {
      const { running } = await f.begin();

      await f.owner.mutation(cancel, { chatId: f.chatId });
      const stopping = await f.inspect();
      expect(stopping.turn?.state.status).toBe("running");
      expect(stopping.user?.credits).toBe(0);
      expect(stopping.chat?.activeTurnId).toBe(f.turnId);
      expect(stopping.streams).toEqual([
        expect.objectContaining({ status: "aborted" }),
      ]);

      // The model never answered. The run still ends: its watch aborts it.
      await running;
      const stopped = await f.inspect();
      expect(stopped.turn?.state.status).toBe("cancelled");
      expect(stopped.user?.credits).toBe(10);
      expect(stopped.chat?.activeTurnId).toBeUndefined();
      expect(
        Arr.filter(stopped.ledger, (row) => row.type === "refund")
      ).toHaveLength(1);
      // It keeps the stages its run reached before the stop: the run took the
      // turn and was about to call the model, and nothing came back.
      expect(stopped.turn?.timing).toEqual({
        claimedMs: expect.any(Number),
        readyMs: expect.any(Number),
      });
      expect(hasAnswer(stopped.messages)).toBe(false);
      // A stop the learner asked for is not an operational failure. The run
      // still notes why it ended, with its turn and the reason and no text.
      expect(report).not.toHaveBeenCalled();
      expect(info).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "INFO",
          message: [
            "Nina run ended after its turn was halted",
            { turnId: f.turnId, reason: "interrupted" },
          ],
        })
      );
    } finally {
      f.release();
    }
  }, 15_000);

  it("does not report a stop that Agent noticed before the watch did", async () => {
    const report = stubReport();
    const f = await createSilentTest();
    try {
      const running = f.t.action(run, { turnId: f.turnId });
      await f.reachesModel(running);
      // The stream is not open yet. Agent finds it stopped when it opens it and
      // ends the generation itself, ahead of the watch's next check.
      await f.owner.mutation(cancel, { chatId: f.chatId });
      await running;

      const stopped = await f.inspect();
      expect(stopped.turn?.state.status).toBe("cancelled");
      expect(stopped.user?.credits).toBe(10);
      expect(hasAnswer(stopped.messages)).toBe(false);
      expect(report).not.toHaveBeenCalled();
    } finally {
      f.release();
    }
  }, 15_000);

  it("reports a settlement that failed after the learner stopped the turn", async () => {
    const report = stubReport();
    const f = await createSilentTest();
    const actual = await vi.importActual<
      typeof import("@repo/backend/confect/nina/sealed/thread")
    >("@repo/backend/confect/nina/sealed/thread");
    try {
      const { running } = await f.begin();
      // The stop reads the journal once and succeeds. The settlement that the
      // run's exit makes reads it next, and that read fails.
      vi.mocked(readThread)
        .mockImplementationOnce(actual.readThread)
        .mockReturnValueOnce(Effect.fail(new SealedReadError()));
      await f.owner.mutation(cancel, { chatId: f.chatId });
      await running;

      // The learner's stop hides nothing about the settlement that was lost.
      expect(report).toHaveBeenCalledOnce();
      const stuck = await f.inspect();
      expect(stuck.turn).toMatchObject({
        phase: "active",
        state: { status: "running" },
        cancelRequestedAt: expect.any(Number),
      });
      expect(stuck.user?.credits).toBe(0);
      expect(stuck.chat?.activeTurnId).toBe(f.turnId);
    } finally {
      f.release();
    }
  }, 15_000);
});

describe("A tool-call repair of a turn that the learner stops", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    provider.languageModel.mockReset();
  });

  it("ends with the stop, so a stopped turn spends no more on the background model", async () => {
    let started: () => void = () => undefined;
    const repairing = new Promise<void>((resolve) => {
      started = resolve;
    });
    let repairSignal: AbortSignal | undefined;
    // The model calls a capability with an input that fails its schema, so the
    // SDK asks Nina to repair it. The repair call never answers: only its
    // signal can end it.
    const languageModel = ninaModel(true, false, { request: 42 });
    languageModel.doGenerate = ({ abortSignal }) => {
      repairSignal = abortSignal;
      started();
      return new Promise((_resolve, reject) => {
        abortSignal?.addEventListener("abort", () =>
          reject(abortSignal.reason)
        );
      });
    };
    provider.languageModel.mockReturnValue(languageModel);
    const f = await createNinaTest({ prompt: "Explain a function limit." });
    const running = f.t.action(run, { turnId: f.turnId });
    await repairing;

    await f.owner.mutation(cancel, { chatId: f.chatId });
    await running;

    expect(repairSignal?.aborted).toBe(true);
    const state = await f.inspect();
    expect(state.turn?.state.status).toBe("cancelled");
    expect(state.user?.credits).toBe(10);
  }, 15_000);
});

describe("The halt watch of a running turn", () => {
  const turnId = Schema.decodeUnknownSync(Id("ninaTurns"))("turn");
  const halted = Ref.getFunctionReference(refs.internal.nina.phase.halted);

  it.effect(
    "keeps asking after one check fails, and aborts the run once a check finds its turn halted",
    () =>
      Effect.gen(function* () {
        // The first read fails the way a lost connection does, the second finds
        // the turn running and the third finds it stopped.
        const runQuery = vi
          .fn()
          .mockRejectedValueOnce(new Error("Private connection failure"))
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(true);
        const halt = yield* watchHalt(turnId).pipe(
          Effect.provide(QueryRunner.layer(runQuery))
        );

        yield* TestClock.adjust("2 seconds");
        expect(halt.aborted).toBe(false);

        yield* TestClock.adjust("2 seconds");
        expect(halt.aborted).toBe(true);
        expect(runQuery).toHaveBeenCalledTimes(3);
        expect(runQuery).toHaveBeenLastCalledWith(halted, { turnId });
      })
  );

  it.effect(
    "counts a read that fails as not halted, and logs the turn and nothing of the failure",
    () =>
      Effect.gen(function* () {
        const logged = MutableRef.make<readonly unknown[]>([]);
        const runQuery = vi
          .fn()
          .mockRejectedValue(new Error("Private connection failure"));
        // The run asks the same question when its generation fails. A read that
        // dies there would replace the failure that the run has to store.
        const isHalted = yield* turnHalted(turnId).pipe(
          Effect.provide(
            Layer.merge(
              QueryRunner.layer(runQuery),
              Logger.layer([
                Logger.formatStructured.pipe(
                  Logger.map(({ message }) =>
                    MutableRef.update(logged, Arr.append(message))
                  )
                ),
              ])
            )
          )
        );

        expect(isHalted).toBe(false);
        expect(MutableRef.get(logged)).toEqual([
          ["Nina halt check failed", { turnId }],
        ]);
        expect(encodeJsonText(MutableRef.get(logged))).not.toContain(
          "Private connection failure"
        );
      })
  );
});
