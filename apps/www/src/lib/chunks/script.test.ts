import { describe, expect, it } from "@effect/vitest";
import { GOING_ATTRIBUTE } from "@repo/design-system/lib/lazy";
import { Effect } from "effect";
import { STALE_CHUNK_SCRIPT } from "@/lib/chunks/script";
import { reloadForStaleChunk } from "@/lib/chunks/stale";
import { QURAN_MARK, tabStorage } from "@/lib/chunks/test.tab";

/** Runs the head script in a document of its own, over the tab's storage. */
function openDocument(
  storage: Pick<Storage, "getItem" | "removeItem" | "setItem">,
  onLine = true
) {
  const navigation = new EventTarget();
  const target = Object.assign(new EventTarget(), { navigation });
  const root = document.createElement("html");
  const reload = vi.fn<() => void>();
  new Function(
    "window",
    "sessionStorage",
    "location",
    "navigator",
    "document",
    STALE_CHUNK_SCRIPT
  )(
    target,
    storage,
    { pathname: "/en/quran", reload },
    { onLine },
    { documentElement: root }
  );
  return { navigation, reload, root, target };
}

/** Starts a navigation of the page, as the Navigation API reports it. */
function navigate(
  navigation: EventTarget,
  to: { readonly download: boolean; readonly sameDocument: boolean }
) {
  navigation.dispatchEvent(
    Object.assign(new Event("navigate"), {
      destination: { sameDocument: to.sameDocument },
      downloadRequest: to.download ? "file.pdf" : null,
    })
  );
}

/** Reports a missing script and says whether the failure was taken over. */
function reportMissingScript(target: EventTarget) {
  const event = new Event("vite:preloadError", { cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

/** A tab's storage, and a reload that counts itself. */
function tab() {
  return { reload: vi.fn(), storage: tabStorage() };
}

describe("STALE_CHUNK_SCRIPT", () => {
  it("reloads once, says so on the root element, and hands each failure on to its import", () => {
    const { reload, root, target } = openDocument(tab().storage);

    expect(reportMissingScript(target)).toBe(false);
    expect(reportMissingScript(target)).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
    expect(root.getAttribute(GOING_ATTRIBUTE)).toBe("reload");
  });

  it("lets the error boundary answer once the tab has reloaded, so it cannot loop", () => {
    const { storage } = tab();
    reportMissingScript(openDocument(storage).target);

    const { reload, root, target } = openDocument(storage);

    expect(reportMissingScript(target)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    expect(root.getAttribute(GOING_ATTRIBUTE)).toBeNull();
  });

  it("reloads a tab that reloaded for an earlier deploy again", () => {
    const { storage } = tab();
    // The mark of an earlier release, which held no time.
    storage.setItem(QURAN_MARK, "1");

    const { reload, target } = openDocument(storage);
    reportMissingScript(target);

    expect(reload).toHaveBeenCalledOnce();
  });

  it.live(
    "shares its mark with the error boundary, so an address reloads once between them",
    () =>
      Effect.gen(function* () {
        const { reload, storage } = tab();
        reportMissingScript(openDocument(storage).target);

        expect(yield* reloadForStaleChunk("/en/quran", storage, reload)).toBe(
          false
        );
        expect(reload).not.toHaveBeenCalled();
      })
  );

  it("keeps the page without a network, and reloads once the network is back", () => {
    const { storage } = tab();
    const offline = openDocument(storage, false);

    reportMissingScript(offline.target);
    expect(offline.reload).not.toHaveBeenCalled();
    expect(offline.root.getAttribute(GOING_ATTRIBUTE)).toBeNull();

    const online = openDocument(storage);

    reportMissingScript(online.target);
    expect(online.reload).toHaveBeenCalledOnce();
  });

  it("keeps a tab that is leaving from cancelling its navigation with a reload", () => {
    const { reload, root, target } = openDocument(tab().storage);

    target.dispatchEvent(new Event("beforeunload"));

    expect(root.getAttribute(GOING_ATTRIBUTE)).toBe("leave");
    expect(reportMissingScript(target)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("keeps a page that a script sends to another address from reloading before it leaves", () => {
    const { navigation, reload, root, target } = openDocument(tab().storage);

    navigate(navigation, { download: false, sameDocument: false });

    expect(root.getAttribute(GOING_ATTRIBUTE)).toBe("leave");
    expect(reportMissingScript(target)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("still reloads a page that moves within itself or downloads a file", () => {
    const { navigation, reload, root, target } = openDocument(tab().storage);

    navigate(navigation, { download: false, sameDocument: true });
    navigate(navigation, { download: true, sameDocument: false });

    expect(root.getAttribute(GOING_ATTRIBUTE)).toBeNull();
    reportMissingScript(target);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("ends the leave at the next press, once a prompt kept the page", () => {
    const { reload, root, target } = openDocument(tab().storage);

    target.dispatchEvent(new Event("beforeunload"));
    target.dispatchEvent(new Event("pointerdown"));

    expect(root.getAttribute(GOING_ATTRIBUTE)).toBeNull();
    reportMissingScript(target);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("gives back the mark of a reload that a prompt stopped, so the next failure reloads", () => {
    const { storage } = tab();
    const { reload, root, target } = openDocument(storage);

    reportMissingScript(target);
    // The reload's own beforeunload leaves its reason as it is.
    target.dispatchEvent(new Event("beforeunload"));
    expect(root.getAttribute(GOING_ATTRIBUTE)).toBe("reload");
    target.dispatchEvent(new Event("keydown"));

    expect(root.getAttribute(GOING_ATTRIBUTE)).toBeNull();
    expect(storage.getItem(QURAN_MARK)).toBeNull();
    reportMissingScript(target);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("keeps a press after a stopped reload from failing where storage refuses removal", () => {
    const { storage } = tab();
    const { reload, root, target } = openDocument({
      ...storage,
      removeItem: () => {
        throw new Error("Storage is off.");
      },
    });

    reportMissingScript(target);
    target.dispatchEvent(new Event("pointerdown"));

    expect(root.getAttribute(GOING_ATTRIBUTE)).toBeNull();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("reloads again once the page comes back from the back-forward cache", () => {
    const { reload, target } = openDocument(tab().storage);

    target.dispatchEvent(new Event("pageshow"));
    target.dispatchEvent(new Event("beforeunload"));
    target.dispatchEvent(new Event("pageshow"));

    reportMissingScript(target);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("never reloads without storage, which could not stop a loop", () => {
    const refused = () => {
      throw new Error("Storage is off.");
    };
    const { reload, root, target } = openDocument({
      getItem: refused,
      removeItem: refused,
      setItem: refused,
    });

    reportMissingScript(target);
    expect(reload).not.toHaveBeenCalled();
    expect(root.getAttribute(GOING_ATTRIBUTE)).toBeNull();
  });
});
