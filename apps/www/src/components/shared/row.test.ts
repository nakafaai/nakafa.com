import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import { pressesRow } from "@/components/shared/row";

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
