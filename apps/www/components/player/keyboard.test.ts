import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import {
  type PlayerKeyContext,
  type PlayerKeyEvent,
  readKeyTarget,
  readPlayerKey,
} from "@/components/player/keyboard";

const idle: PlayerKeyContext = {
  composite: false,
  editable: false,
  locked: false,
  overlay: false,
};

function press(key: string, extra: Partial<PlayerKeyEvent> = {}) {
  return {
    altKey: false,
    ctrlKey: false,
    defaultPrevented: false,
    isComposing: false,
    key,
    metaKey: false,
    repeat: false,
    shiftKey: false,
    ...extra,
  };
}

describe("player shortcuts", () => {
  it.each([
    ["ArrowLeft", { delta: -1, kind: "step" }],
    ["ArrowRight", { delta: 1, kind: "step" }],
    ["f", { kind: "flag" }],
    ["F", { kind: "flag" }],
    ["g", { kind: "navigator" }],
    ["G", { kind: "navigator" }],
    ["1", { index: 0, kind: "pick" }],
    ["5", { index: 4, kind: "pick" }],
  ])("maps %s", (key, intent) => {
    expect(readPlayerKey(press(key), idle)).toEqual(Option.some(intent));
  });

  it.each([
    ["a modifier", press("f", { metaKey: true }), idle],
    ["alt", press("f", { altKey: true }), idle],
    ["ctrl", press("f", { ctrlKey: true }), idle],
    ["shift", press("F", { shiftKey: true }), idle],
    ["composition", press("1", { isComposing: true }), idle],
    ["a handled event", press("1", { defaultPrevented: true }), idle],
    ["typing", press("f"), { ...idle, editable: true }],
    ["an open overlay", press("ArrowRight"), { ...idle, overlay: true }],
    ["a radio group", press("ArrowRight"), { ...idle, composite: true }],
    ["a held key", press("f", { repeat: true }), idle],
    ["a locked flag", press("f"), { ...idle, locked: true }],
    ["a locked pick", press("2"), { ...idle, locked: true }],
    ["other keys", press("6"), idle],
  ])("ignores %s", (_case, event, context) => {
    expect(readPlayerKey(event, context)).toEqual(Option.none());
  });

  it("repeats steps and opens the navigator while locked", () => {
    expect(readPlayerKey(press("ArrowRight", { repeat: true }), idle)).toEqual(
      Option.some({ delta: 1, kind: "step" })
    );
    expect(readPlayerKey(press("g"), { ...idle, locked: true })).toEqual(
      Option.some({ kind: "navigator" })
    );
  });

  it("classifies typing fields and arrow-key widgets", () => {
    document.body.innerHTML = `
      <input id="field" />
      <div contenteditable="true"><span id="rich">text</span></div>
      <div contenteditable="false"><span id="plain">text</span></div>
      <div role="radiogroup"><button id="radio" role="radio"></button></div>
      <button id="button"></button>`;
    const byId = (id: string) => document.getElementById(id);
    expect(readKeyTarget(byId("field"))).toEqual({
      composite: false,
      editable: true,
    });
    expect(readKeyTarget(byId("rich")).editable).toBe(true);
    expect(readKeyTarget(byId("plain")).editable).toBe(false);
    expect(readKeyTarget(byId("radio"))).toEqual({
      composite: true,
      editable: false,
    });
    expect(readKeyTarget(byId("button"))).toEqual({
      composite: false,
      editable: false,
    });
    expect(readKeyTarget(window)).toEqual({
      composite: false,
      editable: false,
    });
  });
});
