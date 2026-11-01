import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Data, Deferred, Effect, MutableRef, Option } from "effect";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useLongAction } from "@/components/shared/pending";

/** The failure an action ends in. */
class LostAnswer extends Data.TaggedError("LostAnswer") {}

/** The hook as the page's last render left it. */
const latest = MutableRef.make<Option.Option<ReturnType<typeof useLongAction>>>(
  Option.none()
);

/** The hook as the page's last render left it. */
function hook() {
  return Option.getOrThrow(MutableRef.get(latest));
}

/** A page that holds the hook and draws nothing. */
function Probe() {
  MutableRef.set(latest, Option.some(useLongAction()));
  return null;
}

let root: Root;

beforeEach(() => {
  root = createRoot(document.createElement("div"));
  act(() => root.render(createElement(Probe)));
});

afterEach(() => {
  act(() => root.unmount());
});

/** Runs what is queued, inside React's act, until the action has settled. */
const settle = () => act(() => Effect.runPromise(Effect.sleep("1 millis")));

describe("useLongAction", () => {
  it("is pending from the press until the action answers", async () => {
    const answer = Deferred.makeUnsafe<void, LostAnswer>();
    expect(hook()[0]).toBe(false);

    act(() => hook()[1](() => Effect.runPromise(Deferred.await(answer))));
    expect(hook()[0]).toBe(true);

    Deferred.doneUnsafe(answer, Effect.void);
    await settle();
    expect(hook()[0]).toBe(false);
  });

  it("ends pending when the action rejects, so the button comes back", async () => {
    const answer = Deferred.makeUnsafe<void, LostAnswer>();
    act(() => hook()[1](() => Effect.runPromise(Deferred.await(answer))));

    Deferred.doneUnsafe(answer, Effect.fail(new LostAnswer()));
    await settle();

    expect(hook()[0]).toBe(false);
  });

  it("leaves the action running after the page has gone", async () => {
    const answer = Deferred.makeUnsafe<void, LostAnswer>();
    const finished = vi.fn();
    act(() =>
      hook()[1](() => Effect.runPromise(Deferred.await(answer)).then(finished))
    );
    act(() => root.unmount());
    root = createRoot(document.createElement("div"));

    Deferred.doneUnsafe(answer, Effect.void);
    await settle();

    expect(finished).toHaveBeenCalledTimes(1);
  });
});
