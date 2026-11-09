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
    "rejects options over the languages or the countries whose icon ignores the entry, and leaves a drawn flag and other lists",
    () =>
      Effect.gen(function* () {
        const rule = (registry: string) =>
          `${VIEW}: the options of ${registry} show one icon for every entry. Each entry carries its own flag: draw it from the entry, as the language lists of components/shared/language do.`;
        assert.deepStrictEqual(
          yield* inspect(`
export function Same() {
  return Arr.map(languages, (language) => <DropdownMenuItem icon={TranslateIcon} key={language.value} />);
}
export function Method() {
  return languages.map(function (language) {
    return <SelectItem icon={TranslateIcon} value={language.value} />;
  });
}
export function Countries() {
  return Arr.map(countries, ([code]) => <PickerItem icon={GlobeIcon} value={code} />);
}
export function Flag() {
  return Arr.map(languages, (language) => <DropdownMenuItem icon={<LanguageFlag country={language.country} />} />);
}
export function Destructured() {
  return Arr.map(countries, ({ code, name: { short } }) => <SelectItem icon={<Flag code={code} />} value={short} />);
}
export function Named() {
  return Arr.map(languages, toItem);
}
export function Units() {
  return Arr.map(units, (unit) => <SelectItem icon={SchoolIcon} value={unit.value} />);
}
export function Bare() {
  return Arr.map(languages, (language) => <DropdownMenuItem {...language} icon><Label /></DropdownMenuItem>);
}
export function Partial() {
  return [Arr.map(languages), languages.map(), Other.map(languages, (language) => language), Arr.filter(languages, Boolean), read()];
}`),
          [rule("languages"), rule("languages"), rule("countries")]
        );
      })
  );

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
