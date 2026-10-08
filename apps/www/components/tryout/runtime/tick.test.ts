import { describe, expect, it } from "@effect/vitest";
import { MutableHashSet } from "effect";
import { notifyTickListeners } from "@/components/tryout/runtime/tick";

describe("tryout runtime tick", () => {
  it("calls every listener once per tick, in subscription order", () => {
    const listeners = MutableHashSet.empty<() => void>();
    const calls: string[] = [];
    for (const name of ["first", "second", "third"]) {
      MutableHashSet.add(listeners, () => {
        calls.push(name);
      });
    }

    notifyTickListeners(listeners);

    expect(calls).toEqual(["first", "second", "third"]);
  });

  it("skips a listener that an earlier listener removed during the same tick", () => {
    const listeners = MutableHashSet.empty<() => void>();
    const calls: string[] = [];
    const removed = () => {
      calls.push("removed");
    };
    MutableHashSet.add(listeners, () => {
      calls.push("remover");
      MutableHashSet.remove(listeners, removed);
    });
    MutableHashSet.add(listeners, removed);
    MutableHashSet.add(listeners, () => {
      calls.push("kept");
    });

    notifyTickListeners(listeners);

    expect(calls).toEqual(["remover", "kept"]);
  });

  it("first calls a listener added during a tick on the next tick", () => {
    const listeners = MutableHashSet.empty<() => void>();
    const calls: string[] = [];
    const added = () => {
      calls.push("added");
    };
    MutableHashSet.add(listeners, () => {
      calls.push("adder");
      MutableHashSet.add(listeners, added);
    });

    notifyTickListeners(listeners);
    expect(calls).toEqual(["adder"]);

    notifyTickListeners(listeners);
    expect(calls).toEqual(["adder", "adder", "added"]);
  });
});
