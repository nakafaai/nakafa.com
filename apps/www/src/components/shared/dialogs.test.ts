import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { MutableRef, Option } from "effect";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useDialogs } from "@/components/shared/dialogs";

type Dialogs = ReturnType<typeof useDialogs<"remove" | "rename">>;

/** The hook as the menu's last render left it. */
const latest = MutableRef.make<Option.Option<Dialogs>>(Option.none());

/** The hook as the menu's last render left it. */
function dialogs() {
  return Option.getOrThrow(MutableRef.get(latest));
}

/** A menu that holds the hook and draws nothing. */
function Probe() {
  MutableRef.set(latest, Option.some(useDialogs<"remove" | "rename">()));
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

describe("useDialogs", () => {
  it("shows no dialog until a press", () => {
    expect(dialogs().kind).toBeNull();
    expect(dialogs().isOpen("rename")).toBe(false);
  });

  it("shows one dialog at a time", () => {
    act(() => dialogs().show("rename"));
    expect(dialogs().isOpen("rename")).toBe(true);
    expect(dialogs().isOpen("remove")).toBe(false);

    act(() => dialogs().show("remove"));
    expect(dialogs().kind).toBe("remove");
    expect(dialogs().isOpen("rename")).toBe(false);
    expect(dialogs().isOpen("remove")).toBe(true);
  });

  it("keeps a closed dialog in place under its key, so it plays its exit", () => {
    act(() => dialogs().show("rename"));
    const { key } = dialogs();

    act(() => dialogs().close());

    expect(dialogs().isOpen("rename")).toBe(false);
    expect(dialogs().kind).toBe("rename");
    expect(dialogs().key).toBe(key);
  });

  it("brings a closed dialog back under the same key, so what was typed stays", () => {
    act(() => dialogs().show("rename"));
    const { key } = dialogs();
    act(() => dialogs().setOpen(false));

    act(() => dialogs().setOpen(true));

    expect(dialogs().isOpen("rename")).toBe(true);
    expect(dialogs().key).toBe(key);
  });

  it("starts each opening of the same dialog under a new key", () => {
    act(() => dialogs().show("rename"));
    const { key } = dialogs();
    act(() => dialogs().close());

    act(() => dialogs().show("rename"));

    expect(dialogs().isOpen("rename")).toBe(true);
    expect(dialogs().key).not.toBe(key);
  });
});
