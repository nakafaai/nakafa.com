import { describe, expect, it } from "@effect/vitest";
import { Building01Icon } from "@hugeicons/core-free-icons";
import { Array as Arr, Schema } from "effect";
import { tableColumns } from "@/components/shared/table/columns";

/** One row of a table in these tests. */
const Row = Schema.Struct({
  at: Schema.Finite,
  name: Schema.String,
  roles: Schema.Array(Schema.String),
  score: Schema.NullOr(Schema.Finite),
  status: Schema.String,
});

const columns = tableColumns<typeof Row.Type>();
const options = [{ icon: Building01Icon, label: "Open", value: "open" }];

describe("the columns of a table", () => {
  it("gives every column of data the filter of what it holds", () => {
    const declared = [
      columns.text((row) => row.name, { header: "Name", id: "name" }),
      columns.number((row) => row.score, { header: "Score", id: "score" }),
      columns.days((row) => row.at, {
        header: "Date",
        id: "date",
        timeZone: () => "Asia/Jakarta",
      }),
      columns.values((row) => row.status, {
        header: "Status",
        id: "status",
        options,
      }),
      columns.list((row) => row.roles, {
        header: "Roles",
        id: "roles",
        options,
      }),
      columns.choice((row) => row.status, {
        header: "State",
        id: "state",
        options,
      }),
    ];

    expect(Arr.map(declared, (column) => column.meta)).toEqual([
      { filter: { kind: "text" }, title: "Name" },
      { filter: { kind: "number" }, title: "Score" },
      { filter: { kind: "days" }, title: "Date" },
      { filter: { kind: "values", options }, title: "Status" },
      { filter: { kind: "values", options }, title: "Roles" },
      { filter: { kind: "choice", options }, title: "State" },
    ]);
  });

  it("sorts by text, numbers and moments, and not by a column of known values", () => {
    expect(
      columns.text((row) => row.name, { header: "Name", id: "name" })
    ).toMatchObject({ filterFn: "holdsText", sortFn: "text" });
    expect(
      columns.number((row) => row.score, { header: "Score", id: "score" })
    ).toMatchObject({ filterFn: "inRange", sortFn: "basic" });
    expect(
      columns.values((row) => row.status, {
        header: "Status",
        id: "status",
        options,
      })
    ).toMatchObject({ enableSorting: false, filterFn: "oneOf" });
    expect(
      columns.list((row) => row.roles, {
        header: "Roles",
        id: "roles",
        options,
      })
    ).toMatchObject({ enableSorting: false, filterFn: "anyOf" });
  });

  it("keeps a column's place and its cell", () => {
    const cell = () => "drawn";

    expect(
      columns.number((row) => row.score, {
        align: "figure",
        cell,
        header: "Score",
        id: "score",
      })
    ).toMatchObject({
      cell,
      meta: { align: "figure", filter: { kind: "number" }, title: "Score" },
    });
  });

  it("keeps the room a wide cell asks for in the column's meta", () => {
    expect(
      columns.number((row) => row.score, {
        header: "Score",
        id: "score",
        wide: true,
      })
    ).toMatchObject({ meta: { wide: true } });
  });

  it("leaves the row's menu the one column with nothing to filter by", () => {
    const cell = () => "menu";

    expect(columns.menu(cell)).toEqual({
      cell,
      id: "actions",
      meta: { align: "menu" },
    });
  });

  it("names the row whose menu does not answer yet", () => {
    const cell = () => "menu";
    const inert = () => true;

    expect(columns.menu(cell, { inert })).toEqual({
      cell,
      id: "actions",
      meta: { align: "menu", inert },
    });
  });
});
