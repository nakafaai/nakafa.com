import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { parseSources } from "#scripts/check/source";
import { inspectTables } from "#scripts/check/tables";

/** A table module, and a settings page that places its children in the page's list card. */
const TABLE = {
  file: "apps/www/src/components/tenant/members.tsx",
  sourceText: `
export function MemberTable() {
  return (
    <TableFiltersProvider>
      <DataTable columns={columns} data={rows} />
    </TableFiltersProvider>
  );
}`,
};
const SECTION = {
  file: "apps/www/src/components/tenant/section.tsx",
  sourceText: `
export function SettingsTablePage({ actions, children }) {
  return (
    <>
      <SchoolHeader>{actions}</SchoolHeader>
      <PageList>{children}</PageList>
    </>
  );
}`,
};
const ROUTE = "apps/www/src/routes/school/members.tsx";
const LOOSE =
  "a DataTable stands outside a list card. A table is the whole body of its page or pane: draw it, or the component that draws it, in PageList, PaneFill or ListCard.";

/** Inspects a route module with the table and the settings page beside it. */
function inspect(sourceText: string) {
  return Effect.scoped(
    Effect.map(
      parseSources([TABLE, SECTION, { file: ROUTE, sourceText }]),
      ({ modules }) => inspectTables(modules)
    )
  );
}

describe("Table source policy", () => {
  it.effect(
    "rejects a table that no page puts in a list card, where the chain starts",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import { MemberTable } from "@/components/tenant/members";
const Receipts = lazy(() =>
  import("@/components/tenant/members").then((module) => ({ default: module.MemberTable }))
);
function MembersPage() {
  return (
    <section>
      <MemberTable />
    </section>
  );
}
function ReceiptsSheet() {
  return (
    <SheetContent>
      <Receipts />
      <DataTable columns={columns} data={rows} />
    </SheetContent>
  );
}`),
          [
            `${ROUTE}:8: ${LOOSE}`,
            `${ROUTE}:15: ${LOOSE}`,
            `${ROUTE}:16: ${LOOSE}`,
          ]
        );
      })
  );

  it.effect(
    "accepts a table in a list card, written around it or around what draws it",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import { MemberTable } from "@/components/tenant/members";
import { SettingsTablePage } from "@/components/tenant/section";
function MembersPage() {
  return (
    <SettingsTablePage actions={<TableSearch />}>
      <MemberTable />
    </SettingsTablePage>
  );
}
function GradesPane() {
  return (
    <PaneFill>
      <DataTable columns={columns} data={rows} />
    </PaneFill>
  );
}
function Grades() {
  return (
    <ListCard>
      <DataTable columns={columns} data={rows} />
    </ListCard>
  );
}
function Part() {
  return <this.Table />;
}
function LinkViews({ children, requests, shown }) {
  return <PageList>{shown === "requests" ? requests : (children)}</PageList>;
}
function Shown({ children, shown }) {
  return <ListCard>{(shown && children) ?? fallback}</ListCard>;
}
function Grants() {
  return (
    <>
      <LinkViews><DataTable columns={columns} data={rows} /></LinkViews>
      <Shown><DataTable columns={columns} data={rows} /></Shown>
    </>
  );
}`),
          []
        );
      })
  );
});
