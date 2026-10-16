import { Ref } from "@confect/core";
import { RegisteredFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import schema from "@repo/backend/confect/_generated/schema";
import { prepareTurn } from "@repo/backend/confect/nina/prepare";
import { createNinaTest } from "@repo/backend/test/nina";
import { Array as Arr, Effect, Predicate } from "effect";

const claim = Ref.getFunctionReference(refs.internal.nina.lifecycle.claim);

/** The internal query of the sealed module that lists one page of a thread, opened for its owner. */
const THREAD_PAGE = "nina/sealed:thread";

/**
 * Prepares the queued turn of a fixture for the model in an action, and
 * returns what it made, with the names of the functions the action called.
 */
async function prepare(f: Awaited<ReturnType<typeof createNinaTest>>) {
  // The run takes its turn from the claim.
  const turn = Ref.decodeReturnsSync(
    refs.internal.nina.lifecycle.claim,
    await f.t.mutation(claim, { turnId: f.turnId })
  );
  assert(turn);
  return f.t.action(async (ctx) => {
    const queries = vi.spyOn(ctx, "runQuery");
    const mutations = vi.spyOn(ctx, "runMutation");
    const actions = vi.spyOn(ctx, "runAction");
    const prepared = await Effect.runPromise(
      prepareTurn(turn).pipe(
        Effect.provide(RegisteredFunction.actionLayer(schema, ctx))
      )
    );
    // An app function names itself, a function of a component names its path.
    const named = (calls: readonly (readonly unknown[])[]) =>
      Arr.map(calls, ([reference]) =>
        Predicate.isObject(reference)
          ? String(
              Reflect.get(reference, Symbol.for("functionName")) ??
                Reflect.get(reference, Symbol.for("toReferencePath"))
            )
          : ""
      );
    return {
      actions: named(actions.mock.calls),
      input: prepared.input,
      mutations: named(mutations.mock.calls),
      queries: named(queries.mock.calls),
    };
  });
}

describe("Nina turn preparation", () => {
  it("reads a short chat in two calls, the brief and the page of messages, and writes nothing", async () => {
    const f = await createNinaTest({ history: 3 });
    const prepared = await prepare(f);
    expect(prepared.queries).toEqual(["nina/brief:read", THREAD_PAGE]);
    expect(prepared.mutations).toEqual([]);
    expect(prepared.actions).toEqual([]);
  });

  it("asks for more turns and more messages only when the chat outgrows the first page of each", async () => {
    const f = await createNinaTest({ history: 40 });
    const prepared = await prepare(f);
    // The brief holds the newest sixteen of the forty turns, which the first
    // page of fifty messages covers. The next sixteen turns reach past that
    // page, so the second page of messages follows, and the last eight turns
    // end the read.
    expect(prepared.queries).toEqual([
      "nina/brief:read",
      THREAD_PAGE,
      "nina/summaries:uncovered",
      THREAD_PAGE,
      "nina/summaries:uncovered",
    ]);
  });
});
