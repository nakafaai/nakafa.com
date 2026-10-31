import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { Option, Schema } from "effect";
import {
  focusAfterDelete,
  focusFirst,
  handFocusOn,
  MEMORY_ADD_ID,
  MEMORY_EDITOR_ID,
  MEMORY_SEARCH_ID,
  memoryNeighbour,
  memoryRowId,
  takeHandedFocus,
} from "@/components/user/settings/memory/focus";
import { learnerMemory } from "@/components/user/settings/memory/list";

const memoryId = Schema.decodeUnknownSync(Id("ninaMemories"));

describe("memory focus", () => {
  it("names each memory's row by the memory, and the same memory always the same way", () => {
    expect(memoryRowId(memoryId("first"))).toBe(memoryRowId(memoryId("first")));
    expect(memoryRowId(memoryId("first"))).not.toBe(
      memoryRowId(memoryId("second"))
    );
  });

  it("gives the focus to the first candidate that takes it, skipping a missing or disabled one", () => {
    document.body.innerHTML =
      '<button disabled id="off" type="button"></button><button id="first" type="button"></button><button id="second" type="button"></button>';

    focusFirst([
      null,
      document.getElementById("off"),
      document.getElementById("first"),
      document.getElementById("second"),
    ]);

    expect(document.activeElement?.id).toBe("first");
  });

  it("leaves the focus where it is when no candidate takes it", () => {
    document.body.innerHTML =
      '<button id="kept" type="button"></button><button disabled id="off" type="button"></button>';
    document.getElementById("kept")?.focus();

    focusFirst([null, document.getElementById("off")]);

    expect(document.activeElement?.id).toBe("kept");
  });
});

describe("memory neighbour", () => {
  const first = learnerMemory(
    { text: "First", title: "" },
    memoryId("first"),
    0
  );
  const second = learnerMemory(
    { text: "Second", title: "" },
    memoryId("second"),
    0
  );
  const third = learnerMemory(
    { text: "Third", title: "" },
    memoryId("third"),
    0
  );
  const memories = [first, second, third];

  it("names the memory after the deleted one, which takes its place", () => {
    expect(Option.getOrNull(memoryNeighbour(memories, first.id))).toBe(
      second.id
    );
  });

  it("names the memory before the deleted one when the deleted one was the last", () => {
    expect(Option.getOrNull(memoryNeighbour(memories, third.id))).toBe(
      second.id
    );
  });

  it("names no memory when the deleted one was the only memory left", () => {
    expect(Option.isNone(memoryNeighbour([first], first.id))).toBe(true);
  });

  it("names no memory when the deleted one is not in the list", () => {
    expect(Option.isNone(memoryNeighbour(memories, memoryId("missing")))).toBe(
      true
    );
  });
});

describe("focus after a delete", () => {
  it("gives the focus to the row of the neighbour while it is on the page", () => {
    document.body.innerHTML = `<button id="${memoryRowId(memoryId("second"))}" type="button"></button><button id="${MEMORY_ADD_ID}" type="button"></button>`;

    expect(focusAfterDelete(Option.some(memoryId("second")))).toBe(
      document.getElementById(memoryRowId(memoryId("second")))
    );
  });

  it("gives the focus to the Add memory button once the neighbour has left the page", () => {
    document.body.innerHTML = `<button id="${MEMORY_ADD_ID}" type="button"></button>`;

    expect(focusAfterDelete(Option.some(memoryId("second")))).toBe(
      document.getElementById(MEMORY_ADD_ID)
    );
  });

  it("gives the focus to the Add memory button when no memory is left", () => {
    document.body.innerHTML = `<button id="${MEMORY_ADD_ID}" type="button"></button>`;

    expect(focusAfterDelete(Option.none())).toBe(
      document.getElementById(MEMORY_ADD_ID)
    );
  });

  it("gives the focus to the Add memory button while the neighbour's row is still waiting to be stored", () => {
    document.body.innerHTML = `<button disabled id="${memoryRowId(memoryId("second"))}" type="button"></button><button id="${MEMORY_ADD_ID}" type="button"></button>`;

    expect(focusAfterDelete(Option.some(memoryId("second")))).toBe(
      document.getElementById(MEMORY_ADD_ID)
    );
  });

  it("leaves the focus in the editor when the editor already holds it, as a refused delete reopens it", () => {
    document.body.innerHTML = `<div id="${MEMORY_EDITOR_ID}"><button id="editing" type="button"></button></div><button id="${memoryRowId(memoryId("second"))}" type="button"></button>`;
    document.getElementById("editing")?.focus();

    expect(focusAfterDelete(Option.some(memoryId("second")))).toBe(false);
  });

  it("hands the focus of a leaving list to the search field and names the row that held it", () => {
    const row = memoryRowId(memoryId("second"));
    document.body.innerHTML = `<input id="${MEMORY_SEARCH_ID}" /><ul id="list"><li><button id="${row}" type="button"></button></li></ul>`;
    document.getElementById(row)?.focus();

    const handed = handFocusOn(document.getElementById("list"));

    expect(handed).toEqual(Option.some(row));
    expect(document.activeElement?.id).toBe(MEMORY_SEARCH_ID);
  });

  it("hands nothing on when the focus is outside the list, the list is gone, or the element has no id", () => {
    document.body.innerHTML = `<input id="${MEMORY_SEARCH_ID}" /><ul id="list"><li><button type="button"></button></li></ul><button id="outside" type="button"></button>`;
    document.getElementById("outside")?.focus();

    expect(handFocusOn(document.getElementById("list"))).toEqual(Option.none());
    expect(handFocusOn(null)).toEqual(Option.none());
    expect(document.activeElement?.id).toBe("outside");

    document.querySelector<HTMLButtonElement>("#list button")?.focus();
    expect(handFocusOn(document.getElementById("list"))).toEqual(Option.none());
    expect(document.activeElement?.id).toBe(MEMORY_SEARCH_ID);
  });

  it("gives the handed focus back to the row in the list that took the leaving one's place", () => {
    const row = memoryRowId(memoryId("second"));
    document.body.innerHTML = `<input id="${MEMORY_SEARCH_ID}" /><ul><li><button id="${row}" type="button"></button></li></ul>`;
    document.getElementById(MEMORY_SEARCH_ID)?.focus();

    takeHandedFocus(Option.some(row));

    expect(document.activeElement?.id).toBe(row);
  });

  it("keeps the focus on the search field when the new list does not hold the row, or nothing was handed", () => {
    document.body.innerHTML = `<input id="${MEMORY_SEARCH_ID}" /><ul></ul>`;
    document.getElementById(MEMORY_SEARCH_ID)?.focus();

    takeHandedFocus(Option.some(memoryRowId(memoryId("second"))));
    takeHandedFocus(Option.none());

    expect(document.activeElement?.id).toBe(MEMORY_SEARCH_ID);
  });
});
