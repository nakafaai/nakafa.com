import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectMenuOrder } from "#scripts/check/order";
import { parseSources } from "#scripts/check/source";

const VIEW = "apps/www/src/components/example.tsx";
const AMONG = `${VIEW}: a destructive or archive item sits among a menu's main actions. A menu reads its label, its actions, then a DropdownMenuSeparator and Archive and Delete last: put the separator before it.`;
const AFTER = `${VIEW}: a main action follows a menu's archive or delete. Archive and Delete close the menu below its separator: move the action above it.`;
const DELETE_FIRST = `${VIEW}: a menu offers Delete before Archive. Archive comes first, and Delete closes the menu.`;

/** Inspects one module with the menu order policy alone. */
function inspect(sourceText: string, file = VIEW) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectMenuOrder(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Menu order source policy", () => {
  it.effect(
    "accepts label, actions, a separator, then Archive and Delete last, and a menu of one delete",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Menu() {
  return (
    <>
      <DropdownMenuContent label={t("menu-actions")}>
        <DropdownMenuItem icon={PencilEdit01Icon}>{t("edit")}</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger icon={Move01Icon}>{t("move")}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent label={t("menu-folder")}>
            <DropdownMenuItem icon={Folder01Icon}>{t("folder")}</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem icon={ArchiveRestoreIcon}>{t("restore")}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={Archive02Icon}>{t("archive")}</DropdownMenuItem>
        <DropdownMenuItem icon={Delete02Icon} variant="destructive">{t("delete")}</DropdownMenuItem>
      </DropdownMenuContent>
      <RowItems>
        <DropdownMenuItem icon={Delete02Icon} variant="destructive">{t("delete")}</DropdownMenuItem>
      </RowItems>
      <DropdownMenuContent label={t("menu-actions")}>
        <DropdownMenuItem icon={Copy01Icon} variant="default">{t("copy")}</DropdownMenuItem>
      </DropdownMenuContent>
    </>
  );
}`),
          []
        );
      })
  );

  it.effect(
    "rejects a delete or an archive among the main actions, by variant, icon or key",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Menu() {
  return (
    <>
      <DropdownMenuContent label={t("menu-actions")}>
        <DropdownMenuItem icon={PencilEdit01Icon}>{t("edit")}</DropdownMenuItem>
        <DropdownMenuItem icon={Delete02Icon} variant="destructive">{t("delete")}</DropdownMenuItem>
      </DropdownMenuContent>
      <DropdownMenuContent label={t("menu-actions")}>
        <DropdownMenuCheckboxItem icon={Pin02Icon}>{t("pin")}</DropdownMenuCheckboxItem>
        <DropdownMenuItem icon={Archive02Icon}>{t("archive")}</DropdownMenuItem>
      </DropdownMenuContent>
      <RowItems>
        <DropdownMenuRadioItem icon={Copy01Icon} value="copy">{t("copy")}</DropdownMenuRadioItem>
        <DropdownMenuItem icon={Box01Icon}>{common("class-archive")}</DropdownMenuItem>
      </RowItems>
    </>
  );
}`),
          [AMONG, AMONG, AMONG]
        );
      })
  );

  it.effect(
    "rejects a main action after the footer, and Delete before Archive",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Menu() {
  return (
    <>
      <DropdownMenuContent label={t("menu-actions")}>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={Delete02Icon} variant="destructive">{t("delete")}</DropdownMenuItem>
        <DropdownMenuItem icon={PencilEdit01Icon}>{t("edit")}</DropdownMenuItem>
      </DropdownMenuContent>
      <DropdownMenuContent label={t("menu-actions")}>
        <DropdownMenuItem icon={Delete02Icon} variant="destructive">{t("delete")}</DropdownMenuItem>
        <DropdownMenuItem icon={Archive02Icon}>{t("archive")}</DropdownMenuItem>
      </DropdownMenuContent>
      <DropdownMenuContent label={t("menu-actions")}>
        <DropdownMenuItem icon={icons.edit} variant={tone}>{t(key)}</DropdownMenuItem>
        <DropdownMenuItem icon>{t}</DropdownMenuItem>
      </DropdownMenuContent>
    </>
  );
}`),
          [AFTER, DELETE_FIRST]
        );
      })
  );

  it.effect("leaves plain TypeScript and the registry's sets alone", () =>
    Effect.gen(function* () {
      const source = `export const Menu = () => (
  <DropdownMenuContent label="Actions">
    <DropdownMenuItem />
    <DropdownMenuItem variant="destructive" />
  </DropdownMenuContent>
);`;
      assert.deepStrictEqual(
        yield* inspect(source, "apps/www/src/components/example.ts"),
        []
      );
      assert.deepStrictEqual(
        yield* inspect(
          source,
          "packages/design-system/components/ui/dropdown-menu.tsx"
        ),
        []
      );
    })
  );
});
