import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { MutableRef, Option } from "effect";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useLongAction } from "@/components/shared/pending";

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
const settle = () =>
  act(async () => {
    await new Promise((done) => {
      setTimeout(done);
    });
  });

describe("useLongAction", () => {
  it("is pending from the press until the action answers", async () => {
    const answer = Promise.withResolvers<void>();
    expect(hook()[0]).toBe(false);

    act(() => hook()[1](() => answer.promise));
    expect(hook()[0]).toBe(true);

    answer.resolve();
    await settle();
    expect(hook()[0]).toBe(false);
  });

  it("ends pending when the action rejects, so the button comes back", async () => {
    const answer = Promise.withResolvers<void>();
    act(() => hook()[1](() => answer.promise));

    answer.reject(new Error("lost"));
    await settle();

    expect(hook()[0]).toBe(false);
  });

  it("leaves the action running after the page has gone", async () => {
    const answer = Promise.withResolvers<void>();
    const finished = vi.fn();
    act(() => hook()[1](() => answer.promise.then(finished)));
    act(() => root.unmount());
    root = createRoot(document.createElement("div"));

    answer.resolve();
    await settle();

    expect(finished).toHaveBeenCalledTimes(1);
  });
});
