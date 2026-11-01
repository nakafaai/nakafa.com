import { describe, expect, it } from "@effect/vitest";
import { pressesRow } from "@/components/shared/row";

/** A table row with a plain cell and a button in another cell. */
const rowOf = () => {
  const row = document.createElement("tr");
  row.innerHTML = "<td>Name</td><td><button><span>Open</span></button></td>";
  document.body.append(row);
  return row;
};

describe("pressesRow", () => {
  it("counts a press on the row's own cell", () => {
    const row = rowOf();

    expect(
      pressesRow({ currentTarget: row, target: row.querySelector("td") })
    ).toBe(true);
  });

  it("leaves a press on a control of the row to that control", () => {
    const row = rowOf();

    expect(
      pressesRow({ currentTarget: row, target: row.querySelector("span") })
    ).toBe(false);
  });

  it("leaves a press that React carried through from a menu the row opened", () => {
    const menu = document.createElement("div");
    document.body.append(menu);

    expect(pressesRow({ currentTarget: rowOf(), target: menu })).toBe(false);
  });

  it("ignores a press with no element behind it", () => {
    expect(pressesRow({ currentTarget: rowOf(), target: null })).toBe(false);
  });
});
