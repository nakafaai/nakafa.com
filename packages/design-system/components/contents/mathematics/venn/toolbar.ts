/**
 * How the operation toolbar lays out its buttons. The toggle group's grid
 * presets run "2" as one row, "3" as 1 then 3 columns, "4" as 2 then 4, and
 * "6" as 2, 3 then 6 as the screen widens; an empty cell in a grid shows the
 * group's border colour as a grey block that reads like a pressed button.
 */

/**
 * The preset for `count` operations, so each notation keeps its width, and
 * how many columns the last operation spans, so no row ends short: five
 * operations in "6" and seven in "4" each leave one cell over, which the
 * last operation fills.
 */
export function toolbarLayout(count: number) {
  if (count <= 2) {
    return { columns: "2", lastSpan: 1 } as const;
  }
  if (count === 3) {
    return { columns: "3", lastSpan: 1 } as const;
  }
  if (count === 4) {
    return { columns: "4", lastSpan: 1 } as const;
  }
  if (count === 7) {
    return { columns: "4", lastSpan: 2 } as const;
  }
  return { columns: "6", lastSpan: count === 5 ? 2 : 1 } as const;
}
