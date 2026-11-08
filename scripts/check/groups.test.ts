import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectGroupSource } from "#scripts/check/groups";
import { parseSources } from "#scripts/check/source";

const VIEW = "apps/www/src/components/example.tsx";
const BUTTON = `${VIEW}: a Button inside a ButtonGroup names its own variant. The group gives every button its one variant, and the page's primary stands outside it: remove the Button's variant, or move the primary out of the group.`;
const SWITCHING = `${VIEW}: a ButtonGroup's variant changes with an expression. A group holds one variant that never switches with state: name it, such as variant="outline", and let a pressed part say so with aria-pressed.`;

/** The finding for a link whose classes draw another variant than its group's. */
function link(variant: string) {
  return `${VIEW}: a link inside a ButtonGroup draws another variant than the group's. A group holds one variant: write buttonVariants({ variant: "${variant}" }).`;
}

/** Inspects one module with the button group policy alone. */
function inspect(sourceText: string, file = VIEW) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectGroupSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Button group source policy", () => {
  it.effect(
    "rejects a Button that names its own variant in a group's row, a trigger's render included",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Header({ archived }: { archived: boolean }) {
  return (
    <ButtonGroup>
      <Button onClick={create}>New</Button>
      <Button variant={archived ? "secondary" : "outline"}>Archived</Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="icon" variant="outline" />} />
      </DropdownMenu>
      <span><Button variant="default">Save</Button></span>
    </ButtonGroup>
  );
}`),
          [BUTTON, BUTTON, BUTTON]
        );
      })
  );

  it.effect(
    "leaves a Button alone outside a group, inside a popup the row opens, and in a nested group",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Header() {
  return (
    <>
      <Button variant="default">Create</Button>
      <ButtonGroup>
        <Button>Archived</Button>
        <DropdownMenu>
          <DropdownMenuContent label={t("menu-actions")}>
            <Button variant="default">Apply</Button>
          </DropdownMenuContent>
        </DropdownMenu>
        <SheetPopup><Button variant="default">Save</Button></SheetPopup>
        <ResponsiveDialog><Button variant="default">Send</Button></ResponsiveDialog>
        <ButtonGroup variant="secondary">
          <Button>Zoom</Button>
        </ButtonGroup>
      </ButtonGroup>
      <ButtonGroup />
    </>
  );
}`),
          []
        );
      })
  );

  it.effect("rejects a group whose variant switches with state", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
export function Header({ active }: { active: boolean }) {
  return (
    <ButtonGroup variant={active ? "secondary" : "outline"}>
      <Button variant="outline">One</Button>
    </ButtonGroup>
  );
}`),
        [SWITCHING]
      );
    })
  );

  it.effect(
    "holds a link's classes to the group's variant, the default outline included",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Links() {
  return (
    <>
      <ButtonGroup>
        <a className={buttonVariants({ variant: "outline" })} href="/a">A</a>
        <a className={buttonVariants({ variant: "default" })} href="/b">B</a>
        <a className={buttonVariants()} href="/c">C</a>
        <a className={buttonVariants({ size: "sm", variant: kind })} href="/d">D</a>
        <a className={cn(buttonVariants({ ...look }))} href="/e">E</a>
        <a className={other({ variant: "default" })} href="/f">F</a>
      </ButtonGroup>
      <ButtonGroup variant="inverse-outline">
        <a className={buttonVariants({ variant: "inverse-outline" })} href="/g">G</a>
        <a className={buttonVariants({ variant: "outline" })} href="/h">H</a>
      </ButtonGroup>
    </>
  );
}`),
          [
            link("outline"),
            link("outline"),
            link("outline"),
            link("outline"),
            link("inverse-outline"),
          ]
        );
      })
  );

  it.effect("leaves plain TypeScript and the registry's sets alone", () =>
    Effect.gen(function* () {
      const source = `export const Row = () => (
  <ButtonGroup><Button variant="default">Save</Button></ButtonGroup>
);`;
      assert.deepStrictEqual(
        yield* inspect(source, "apps/www/src/components/example.ts"),
        []
      );
      assert.deepStrictEqual(
        yield* inspect(
          source,
          "packages/design-system/components/ui/button-group.tsx"
        ),
        []
      );
    })
  );
});
