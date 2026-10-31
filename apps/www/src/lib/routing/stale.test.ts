import { describe, expect, it } from "@effect/vitest";
import { STALE_CHUNK_SCRIPT } from "@/lib/routing/stale";

/** Runs the head script in a document of its own, over the tab's storage. */
function openDocument(storage: Pick<Storage, "getItem" | "setItem">) {
  const target = new EventTarget();
  const reload = vi.fn<() => void>();
  new Function("window", "sessionStorage", "location", STALE_CHUNK_SCRIPT)(
    target,
    storage,
    { reload }
  );
  return { reload, target };
}

/** Session storage as a tab holds it across its reloads. */
function tabStorage() {
  let stored: string | null = null;
  return {
    getItem: () => stored,
    setItem: (_: string, value: string) => {
      stored = value;
    },
  };
}

/** Reports a missing script and says whether the failure was taken over. */
function reportMissingScript(target: EventTarget) {
  const event = new Event("vite:preloadError", { cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("STALE_CHUNK_SCRIPT", () => {
  it("reloads once and holds back every failure until the page goes", () => {
    const { reload, target } = openDocument(tabStorage());

    expect(reportMissingScript(target)).toBe(true);
    expect(reportMissingScript(target)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("lets the error boundary answer once the tab has reloaded, so it cannot loop", () => {
    const storage = tabStorage();
    reportMissingScript(openDocument(storage).target);

    const { reload, target } = openDocument(storage);

    expect(reportMissingScript(target)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("never reloads without storage, which could not stop a loop", () => {
    const refused = () => {
      throw new Error("Storage is off.");
    };
    const { reload, target } = openDocument({
      getItem: refused,
      setItem: refused,
    });

    expect(reportMissingScript(target)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
