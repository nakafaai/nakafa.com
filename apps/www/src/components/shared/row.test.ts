import { afterEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { pressesRow, useRowPress } from "@/components/shared/row";

/** A table row with a plain cell and a button in another cell. */
const rowOf = () => {
  const row = document.createElement("tr");
  row.innerHTML = "<td>Name</td><td><button><span>Open</span></button></td>";
  document.body.append(row);
  return row;
};

/** The element of a row that the test presses. */
const elementOf = (row: HTMLTableRowElement, selector: string) =>
  Option.getOrThrow(Option.fromNullishOr(row.querySelector(selector)));

describe("pressesRow", () => {
  it("counts a press on the row's own cell", () => {
    const row = rowOf();

    expect(
      pressesRow({ currentTarget: row, target: elementOf(row, "td") })
    ).toBe(true);
  });

  it("leaves a press on a control of the row to that control", () => {
    const row = rowOf();

    expect(
      pressesRow({ currentTarget: row, target: elementOf(row, "span") })
    ).toBe(false);
  });

  it("leaves a press in a popup that the row opened inside itself, such as an option of its dialog's select", () => {
    const row = rowOf();
    const popup = document.createElement("div");
    popup.setAttribute("popover", "manual");
    popup.innerHTML = '<div role="option"><span>Teacher</span></div>';
    elementOf(row, "td").append(popup);

    expect(
      pressesRow({ currentTarget: row, target: elementOf(row, "span") })
    ).toBe(false);
    expect(
      pressesRow({
        currentTarget: row,
        target: elementOf(row, "[role=option] span"),
      })
    ).toBe(false);
  });

  it("leaves a press that React carried through from a menu the row opened", () => {
    const menu = document.createElement("div");
    document.body.append(menu);

    expect(pressesRow({ currentTarget: rowOf(), target: menu })).toBe(false);
  });

  it("ignores a press with no element behind it", () => {
    expect(
      pressesRow({ currentTarget: rowOf(), target: new EventTarget() })
    ).toBe(false);
  });
});

/** The rows that the drawn row opened, in order. */
let opened: readonly HTMLTableRowElement[] = [];

/** A table row that opens through `useRowPress`, with a plain cell and a button in another cell. */
function PressRow() {
  const press = useRowPress((row) => {
    opened = Arr.append(opened, row);
  });

  return createElement(
    "tr",
    press,
    createElement("td", null, "Name"),
    createElement(
      "td",
      null,
      createElement("button", { type: "button" }, "Open")
    )
  );
}

let root: Root | undefined;

/** Draws one `PressRow` in a table on the page and returns the page's table. */
const drawRow = () => {
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root?.render(
      createElement(
        "table",
        null,
        createElement("tbody", null, createElement(PressRow))
      )
    )
  );
  return container;
};

/** Sends a pointer's press down on `element`, as a browser does before its click. */
const pressDown = (element: Element) =>
  act(() => {
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });

/** Sends a click to `element`. */
const click = (element: HTMLElement) =>
  act(() => {
    element.click();
  });

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  opened = [];
  document.body.replaceChildren();
});

describe("useRowPress", () => {
  it("opens the row when a press begins and ends on its own cell", () => {
    const table = drawRow();
    const cell = Option.getOrThrow(
      Option.fromNullishOr(table.querySelector("td"))
    );

    pressDown(cell);
    click(cell);

    expect(opened).toEqual([table.querySelector("tr")]);
  });

  it("opens nothing when a press began on a control and its click reaches the cell", () => {
    const table = drawRow();
    const cell = Option.getOrThrow(
      Option.fromNullishOr(table.querySelector("td"))
    );

    pressDown(
      Option.getOrThrow(Option.fromNullishOr(table.querySelector("button")))
    );
    click(cell);

    expect(opened).toEqual([]);
  });

  it("opens the row on a click with no press before it, and judges each press on its own", () => {
    const table = drawRow();
    const cell = Option.getOrThrow(
      Option.fromNullishOr(table.querySelector("td"))
    );
    const button = Option.getOrThrow(
      Option.fromNullishOr(table.querySelector("button"))
    );

    pressDown(button);
    click(button);
    click(cell);

    expect(opened).toEqual([table.querySelector("tr")]);
  });
});
