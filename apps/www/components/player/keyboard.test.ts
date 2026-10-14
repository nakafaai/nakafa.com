import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  pickOption,
  readKeyTarget,
  readPlayerKey,
} from "@/components/player/keyboard";

type KeyEvent = Parameters<typeof readPlayerKey>[0];
type KeyContext = Parameters<typeof readPlayerKey>[1];

const idle: KeyContext = {
  composite: false,
  editable: false,
  locked: false,
  overlay: "none",
};

/** A key press with no modifier, as the browser reports it. */
function press(key: string, change: Partial<KeyEvent> = {}): KeyEvent {
  return {
    altKey: false,
    ctrlKey: false,
    defaultPrevented: false,
    isComposing: false,
    key,
    metaKey: false,
    repeat: false,
    shiftKey: false,
    ...change,
  };
}

describe("player keys", () => {
  it.each([
    ["ArrowLeft", { delta: -1, kind: "step" }],
    ["ArrowRight", { delta: 1, kind: "step" }],
    ["g", { kind: "navigator" }],
    ["G", { kind: "navigator" }],
    ["1", { index: 0, kind: "pick" }],
    ["5", { index: 4, kind: "pick" }],
  ])("maps %s", (key, intent) => {
    expect(readPlayerKey(press(key), idle)).toEqual(Option.some(intent));
  });

  it.each([
    ["a modifier", press("g", { metaKey: true }), idle],
    ["alt", press("g", { altKey: true }), idle],
    ["ctrl", press("g", { ctrlKey: true }), idle],
    ["shift", press("G", { shiftKey: true }), idle],
    ["composition", press("1", { isComposing: true }), idle],
    ["a handled key", press("ArrowRight", { defaultPrevented: true }), idle],
    ["typing", press("1"), { ...idle, editable: true }],
    ["a digit outside the five", press("6"), idle],
    ["another key", press("x"), idle],
    ["a held digit", press("1", { repeat: true }), idle],
    ["a held navigator key", press("g", { repeat: true }), idle],
    ["a digit after time ran out", press("2"), { ...idle, locked: true }],
  ])("ignores %s", (_case, event, context) => {
    expect(readPlayerKey(event, context)).toEqual(Option.none());
  });

  it("repeats steps while a key is held", () => {
    expect(readPlayerKey(press("ArrowRight", { repeat: true }), idle)).toEqual(
      Option.some({ delta: 1, kind: "step" })
    );
  });

  it("leaves the arrows to a widget that owns them but not the digits", () => {
    const radio = { ...idle, composite: true };

    expect(readPlayerKey(press("ArrowRight"), radio)).toEqual(Option.none());
    expect(readPlayerKey(press("2"), radio)).toEqual(
      Option.some({ index: 1, kind: "pick" })
    );
  });

  it("still opens the navigator after time ran out", () => {
    expect(readPlayerKey(press("g"), { ...idle, locked: true })).toEqual(
      Option.some({ kind: "navigator" })
    );
  });

  it("gives every key to the finish dialog", () => {
    const finishing: KeyContext = { ...idle, overlay: "finish" };

    expect(readPlayerKey(press("g"), finishing)).toEqual(Option.none());
    expect(readPlayerKey(press("ArrowLeft"), finishing)).toEqual(Option.none());
    expect(readPlayerKey(press("1"), finishing)).toEqual(Option.none());
  });

  it("lets only the navigator key through while the navigator is open", () => {
    const open: KeyContext = { ...idle, overlay: "navigator" };

    expect(readPlayerKey(press("g"), open)).toEqual(
      Option.some({ kind: "navigator" })
    );
    expect(readPlayerKey(press("g", { repeat: true }), open)).toEqual(
      Option.none()
    );
    expect(readPlayerKey(press("ArrowRight"), open)).toEqual(Option.none());
    expect(readPlayerKey(press("1"), open)).toEqual(Option.none());
  });
});

describe("readKeyTarget", () => {
  it("tells typing fields and arrow-key widgets from plain controls", () => {
    document.body.innerHTML = `
      <input id="field" />
      <div contenteditable="true"><span id="rich">text</span></div>
      <div contenteditable="false"><span id="plain">text</span></div>
      <div role="radiogroup"><span id="radio" role="radio"></span></div>
      <button id="button"></button>`;
    const find = (id: string) => document.getElementById(id);

    expect(readKeyTarget(find("field"))).toEqual({
      composite: false,
      editable: true,
    });
    expect(readKeyTarget(find("rich"))).toEqual({
      composite: false,
      editable: true,
    });
    expect(readKeyTarget(find("plain"))).toEqual({
      composite: false,
      editable: false,
    });
    expect(readKeyTarget(find("radio"))).toEqual({
      composite: true,
      editable: false,
    });
    expect(readKeyTarget(find("button"))).toEqual({
      composite: false,
      editable: false,
    });
  });

  it("treats a target that is no element as neither", () => {
    expect(readKeyTarget(window)).toEqual({
      composite: false,
      editable: false,
    });
    expect(readKeyTarget(null)).toEqual({ composite: false, editable: false });
  });
});

describe("pickOption", () => {
  const options = [
    { label: "First", optionKey: "first", order: 1 },
    { label: "Second", optionKey: "second", order: 2 },
  ];

  it("selects the option at the position of the digit", () => {
    expect(pickOption({ kind: "single-choice", options }, 1)).toEqual(
      Option.some({ kind: "single-choice", optionKey: "second" })
    );
  });

  it("selects nothing when the question has fewer options", () => {
    expect(pickOption({ kind: "single-choice", options }, 2)).toEqual(
      Option.none()
    );
  });

  it("selects nothing in a question that is not single choice", () => {
    expect(pickOption({ kind: "multiple-choice", options }, 0)).toEqual(
      Option.none()
    );
  });
});
