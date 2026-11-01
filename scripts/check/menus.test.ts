import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectMenuSource } from "#scripts/check/menus";
import { parseSources } from "#scripts/check/source";

const VIEW = "apps/www/src/components/example.tsx";
const UNLABELLED = `${VIEW}: a dropdown holds no DropdownMenuLabel. Every dropdown names what it holds in one word: add the label inside its DropdownMenuGroup.`;

/** Inspects one module with the menu policy alone. */
function inspect(sourceText: string, file = VIEW) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectMenuSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Menu source policy", () => {
  it.effect("rejects a dropdown or a submenu of items alone", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
export function Menu() {
  return (
    <DropdownMenuContent>
      <DropdownMenuSubContent>
        <DropdownMenuItem />
      </DropdownMenuSubContent>
      <DropdownMenuGroup><DropdownMenuLabel>Sort</DropdownMenuLabel></DropdownMenuGroup>
    </DropdownMenuContent>
  );
}
export function Empty() {
  return <DropdownMenuContent />;
}`),
        [UNLABELLED, UNLABELLED]
      );
    })
  );

  it.effect("accepts a dropdown that holds its label", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
export function Menu() {
  return (
    <DropdownMenuContent>
      <DropdownMenuGroup>
        <DropdownMenuLabel>Sort</DropdownMenuLabel>
        <DropdownMenuItem />
      </DropdownMenuGroup>
    </DropdownMenuContent>
  );
}`),
        []
      );
    })
  );

  it.effect("rejects a table with no menu column", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
const rowColumns = tableColumns<Row>();
const otherColumns = tableColumns<Row>();
const columns = [rowColumns.text(read, spec), otherColumns.menu(cell), other.menu(cell)];`),
        [
          `${VIEW}: rowColumns has no menu column. Every row of every table has one action: declare rowColumns.menu(...), whose cell gives RowItems the row's items.`,
        ]
      );
    })
  );

  it.effect("rejects a button in a menu column", () =>
    Effect.gen(function* () {
      const violation = `${VIEW}: rowColumns.menu draws a button. A row's one action is the three-dot menu the table draws: give RowItems a DropdownMenuItem instead.`;
      assert.deepStrictEqual(
        yield* inspect(`
const rowColumns = tableColumns<Row>();
const columns = [
  rowColumns.menu(() => <Button onClick={restore}>Restore</Button>),
  rowColumns.menu(() => <Link className={buttonVariants()} to="/" />),
  rowColumns.menu(() => <RowItems><Item /></RowItems>),
  rowColumns.menu(cell),
];`),
        [violation, violation]
      );
    })
  );

  it.effect("leaves plain TypeScript and the registry's sets alone", () =>
    Effect.gen(function* () {
      const source = "const rowColumns = tableColumns<Row>();";
      assert.deepStrictEqual(
        yield* inspect(source, "apps/www/src/components/example.ts"),
        []
      );
      assert.deepStrictEqual(
        yield* inspect(
          "export const Menu = () => <DropdownMenuContent />;",
          "packages/design-system/components/ui/dropdown-menu.tsx"
        ),
        []
      );
    })
  );
});
