import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  ForumContextProvider,
  useForum,
} from "@/components/school/classes/forum/conversation/context/use-forum";

const mountedRoots: Array<() => void> = [];

/** Mounts one forum context subtree and returns the detached DOM container. */
function render(element: React.ReactNode) {
  const container = document.createElement("div");
  const root = createRoot(container);

  document.body.append(container);

  act(() => {
    root.render(element);
  });

  mountedRoots.push(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  return container;
}

afterEach(() => {
  while (mountedRoots.length > 0) {
    mountedRoots.pop()?.();
  }
});

describe("conversation/context/use-forum", () => {
  it("exposes one selected slice from the feature-local forum store", () => {
    let replyTo = "pending";

    /** Reads one representative slice from the active forum store. */
    function Probe() {
      replyTo = String(useForum((state) => state.replyTo));
      return null;
    }

    render(
      <ForumContextProvider classId="class_1">
        <Probe />
      </ForumContextProvider>
    );

    expect(replyTo).toBe("null");
  });
});
