import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectMenuSource } from "#scripts/check/menus";
import { parseSources } from "#scripts/check/source";

const VIEW = "apps/www/src/components/example.tsx";

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
  it.effect(
    "rejects an icon on a sidebar group label and leaves a label of text alone",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Group() {
  return <SidebarGroupLabel><HugeIcons icon={Icon} />Units</SidebarGroupLabel>;
}
export function Plain() {
  return <SidebarGroupLabel>Units</SidebarGroupLabel>;
}`),
          [
            `${VIEW}: a sidebar group label holds an icon. A group label is text alone: keep the icon on the items under it.`,
          ]
        );
      })
  );

  it.effect(
    "rejects a dropdown, a submenu or a select whose label is text of its own",
    () =>
      Effect.gen(function* () {
        const own = (tag: string) =>
          `${VIEW}: a ${tag} writes its own label. A dropdown names what is chosen in one word: read it from a menu- key, such as label={t("menu-actions")}.`;
        assert.deepStrictEqual(
          yield* inspect(`
export function Menu() {
  return (
    <>
      <DropdownMenuContent label="Actions" />
      <DropdownMenuSubContent label={\`Open\`}>
        <DropdownMenuItem icon={Icon} />
      </DropdownMenuSubContent>
      <SelectContent label={t("class-choice")} />
      <SelectContent label={t(key)} />
      <SelectContent label={t()} />
      <DropdownMenuContent label={\`\${name} menu\`} />
      <PickerContent label={t("history")} />
    </>
  );
}`),
          [
            own("DropdownMenuContent"),
            own("DropdownMenuSubContent"),
            own("SelectContent"),
            own("SelectContent"),
            own("SelectContent"),
            own("DropdownMenuContent"),
            own("PickerContent"),
          ]
        );
      })
  );

  it.effect(
    "accepts a label read from a menu- key, and one the component receives",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Menu({ menu }: { menu: string }) {
  return (
    <>
      <DropdownMenuContent label={t("menu-actions")} />
      <SelectContent label={t("Common.menu-class")} />
      <DropdownMenuSubContent label={menu} />
      <SelectContent label={labels.menu} />
      <DropdownMenuContent label={} />
      <DropdownMenuContent label />
      <DropdownMenuContent {...props} />
      <Other label="Free" />
    </>
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
