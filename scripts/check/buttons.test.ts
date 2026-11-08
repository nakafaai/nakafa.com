import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectButtonSource } from "#scripts/check/buttons";
import { parseSources } from "#scripts/check/source";

const VIEW = "apps/www/src/components/example.tsx";
const BARE = `${VIEW}: a button holds an icon alone without a tooltip. An icon button takes size="icon" or size="icon-sm" and the tooltip that names its action.`;
const SMALL = `${VIEW}: a button sets a height under the small button's. Buttons keep to the design system's size scale: use size="sm" or size="icon-sm", never a smaller class.`;
const LINK = `${VIEW}: a link drawn as an icon button has no tooltip. Render it from a TooltipTrigger with a TooltipContent that names where it goes.`;

/** Inspects one module with the button policy alone. */
function inspect(sourceText: string, file = VIEW) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectButtonSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Button source policy", () => {
  it.effect(
    "rejects an icon alone in a button or a trigger without an icon size",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Row() {
  return (
    <>
      <Button variant="ghost">
        <HugeIcons icon={MoreHorizontalIcon} />
      </Button>
      <InputGroupButton><Spinner isLoading /></InputGroupButton>
      <Button size="sm"><HugeIcons icon={Add01Icon} /></Button>
      <DropdownMenuTrigger render={<Button variant="ghost" />}>
        <HugeIcons icon={MoreHorizontalIcon} />
      </DropdownMenuTrigger>
      <PopoverTrigger render={<Button size={size} />}>
        <svg />
      </PopoverTrigger>
    </>
  );
}`),
          [BARE, BARE, BARE, BARE, BARE]
        );
      })
  );

  it.effect(
    "accepts an icon button with an icon size and a button with words",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Row() {
  return (
    <>
      <Button size="icon" tooltip={t("more")}><HugeIcons icon={MoreHorizontalIcon} /></Button>
      <Button size="icon-sm"><HugeIcons icon={MoreHorizontalIcon} /></Button>
      <Button variant="ghost"><HugeIcons icon={Add01Icon} />{t("add")}</Button>
      <Button size="sm">{t("save")}</Button>
      <Button size="sm" tooltip={t("style")}><HugeIcons icon={TextIcon} /><HugeIcons icon={ArrowDown01Icon} /></Button>
      <Button />
      <Button>{"  "}</Button>
      <DropdownMenuTrigger render={<Button size="icon-sm" tooltip={t("more")} />}>
        <HugeIcons icon={MoreHorizontalIcon} />
      </DropdownMenuTrigger>
      <DropdownMenuTrigger render={<Button variant="outline" />}>{t("menu")}</DropdownMenuTrigger>
      <DropdownMenuTrigger render={<Link />}><HugeIcons icon={Add01Icon} /></DropdownMenuTrigger>
      <DropdownMenuTrigger render={() => null}><HugeIcons icon={Add01Icon} /></DropdownMenuTrigger>
      <DropdownMenuTrigger render={<Button />} />
    </>
  );
}`),
          []
        );
      })
  );

  it.effect("rejects a height under the small button's on a button", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
export function Row() {
  return (
    <>
      <Button className="h-6 px-2">{t("a")}</Button>
      <Button className={cn("w-full", active && "size-7")} size="sm">{t("b")}</Button>
      <InputGroupButton className={\`min-h-5 \${extra}\`}>{t("c")}</InputGroupButton>
      <Button className="h-8 sm:size-9">{t("d")}</Button>
      <Button className={classes}>{t("e")}</Button>
      <div className="h-6" />
    </>
  );
}`),
        [SMALL, SMALL, SMALL]
      );
    })
  );

  it.effect(
    "rejects an icon link that no TooltipTrigger renders and accepts one it does",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Links() {
  return (
    <>
      <a className={buttonVariants({ size: "icon", variant: "outline" })} href="/a"><HugeIcons icon={Add01Icon} /></a>
      <TooltipTrigger render={<a className={buttonVariants({ size: "icon-sm" })} href="/b" />} />
      <a className={buttonVariants({ size: "sm" })} href="/c">C</a>
      <a className={buttonVariants({ size: iconSize })} href="/d">D</a>
      <a className={buttonVariants({ ...look })} href="/e">E</a>
      <a className={buttonVariants()} href="/f">F</a>
      <a className={other({ size: "icon" })} href="/g">G</a>
    </>
  );
}`),
          [LINK]
        );
      })
  );

  it.effect("leaves plain TypeScript and the registry's sets alone", () =>
    Effect.gen(function* () {
      const source = `export const Row = () => (
  <Button className="h-6"><HugeIcons icon={Add01Icon} /></Button>
);`;
      assert.deepStrictEqual(
        yield* inspect(source, "apps/www/src/components/example.ts"),
        []
      );
      assert.deepStrictEqual(
        yield* inspect(
          source,
          "packages/design-system/components/ui/button.tsx"
        ),
        []
      );
    })
  );
});
