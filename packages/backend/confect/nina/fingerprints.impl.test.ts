import { Ref } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { createNinaTest } from "@repo/backend/test/nina";
import { args } from "@repo/backend/test/nina/admission";
import { NOW } from "@repo/backend/test/nina/planted";
import { earlierTurnIn } from "@repo/backend/test/nina/seal";
import { fingerprintsIn } from "@repo/backend/test/nina/sealed";
import { Array as Arr } from "effect";

const clear = Ref.getFunctionReference(refs.internal.nina.fingerprints.clear);

/** The unkeyed fingerprint of a request: 64 lower-case hexadecimal characters, as `turns.start` stored it. */
const UNKEYED = "0123456789abcdef".repeat(4);

type Fixture = Awaited<ReturnType<typeof createNinaTest>>;

/** A turn as the database stores it. */
function storedTurnIn(f: Fixture, turnId: Fixture["turnId"]) {
  return f.t.query((ctx) => ctx.db.get("ninaTurns", turnId));
}

/** Stores a fingerprint on a turn, the way `turns.start` stored one. */
function setFingerprint(
  f: Fixture,
  turnId: Fixture["turnId"],
  fingerprint: string
) {
  return f.t.mutation((ctx) =>
    ctx.db.patch("ninaTurns", turnId, { fingerprint })
  );
}

describe("Clearing the unkeyed request fingerprints of Nina turns (one-off)", () => {
  it("clears the unkeyed fingerprint of a settled turn and leaves the rest of the turn as it was", async () => {
    const f = await createNinaTest({ history: [{ steps: 1 }], now: NOW });
    const turn = await earlierTurnIn(f.t);
    await setFingerprint(f, turn._id, UNKEYED);
    const before = await storedTurnIn(f, turn._id);

    const result = await f.t.mutation(clear, { dryRun: false });

    expect(result).toEqual({
      activeOld: 0,
      cleared: 1,
      done: true,
      scanned: 2,
    });
    expect(await storedTurnIn(f, turn._id)).toEqual({
      ...before,
      fingerprint: undefined,
    });
  });

  it("keeps a settled turn's keyed fingerprint, which holds 22 URL-safe characters", async () => {
    const f = await createNinaTest({ history: [{ steps: 1 }], now: NOW });
    const turn = await earlierTurnIn(f.t);
    const { keyed } = await fingerprintsIn(f.t, f.identity.userId, args.input);
    await setFingerprint(f, turn._id, keyed);
    const before = await storedTurnIn(f, turn._id);

    const result = await f.t.mutation(clear, { dryRun: false });

    expect(result).toEqual({
      activeOld: 0,
      cleared: 0,
      done: true,
      scanned: 2,
    });
    expect(await storedTurnIn(f, turn._id)).toEqual(before);
  });

  it("skips an active turn that holds the unkeyed fingerprint, and counts it", async () => {
    const f = await createNinaTest({ history: [{ steps: 1 }], now: NOW });
    await setFingerprint(f, f.turnId, UNKEYED);
    const before = await storedTurnIn(f, f.turnId);

    const result = await f.t.mutation(clear, { dryRun: false });

    expect(result).toEqual({
      activeOld: 1,
      cleared: 0,
      done: true,
      scanned: 2,
    });
    expect(before).toMatchObject({ fingerprint: UNKEYED, phase: "active" });
    expect(await storedTurnIn(f, f.turnId)).toEqual(before);
  });

  it("writes nothing on a dry run, and counts what a run would clear", async () => {
    const f = await createNinaTest({ history: [{ steps: 1 }], now: NOW });
    const turn = await earlierTurnIn(f.t);
    await setFingerprint(f, turn._id, UNKEYED);
    await setFingerprint(f, f.turnId, UNKEYED);
    const settledBefore = await storedTurnIn(f, turn._id);
    const activeBefore = await storedTurnIn(f, f.turnId);

    const result = await f.t.mutation(clear, { dryRun: true });

    expect(result).toEqual({
      activeOld: 1,
      cleared: 1,
      done: true,
      scanned: 2,
    });
    expect(await storedTurnIn(f, turn._id)).toEqual(settledBefore);
    expect(await storedTurnIn(f, f.turnId)).toEqual(activeBefore);
  });

  it("reaches every turn across two pages, and clears the unkeyed fingerprint of each settled turn", async () => {
    // Eleven settled turns and the queued turn make twelve rows, so the table takes two pages
    // of ten turns. The first call schedules the call that reads the second page.
    const f = await createNinaTest({
      history: Arr.makeBy(11, () => ({})),
      now: NOW,
    });
    const turns = await f.t.query((ctx) => ctx.db.query("ninaTurns").collect());
    for (const turn of turns) {
      if (turn.phase === "settled") {
        await setFingerprint(f, turn._id, UNKEYED);
      }
    }

    const first = await f.t.mutation(clear, { dryRun: false });
    expect(first).toMatchObject({ done: false, scanned: 10 });
    await f.t.finishAllScheduledFunctions(() => undefined);

    const after = await f.t.query((ctx) => ctx.db.query("ninaTurns").collect());
    const settled = Arr.filter(after, (turn) => turn.phase === "settled");
    expect(settled).toHaveLength(11);
    expect(
      Arr.filter(settled, (turn) => turn.fingerprint !== undefined)
    ).toEqual([]);
  });
});
