import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectDrillingSource } from "#scripts/check/drilling";
import { parseSources } from "#scripts/check/source";

const VIEW = "apps/www/src/components/example.tsx";

/** Inspects one TSX module with the drilling policy alone. */
function inspect(sourceText: string, file = VIEW) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectDrillingSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

/** The message for one prop that a component only hands on. */
function drilled(component: string, prop: string, targets: string) {
  return `${VIEW}: ${component} receives ${prop} only to pass it to ${targets}. Let the component that reads it take it from a context or a store its provider creates, or compose that component as children, instead of drilling the prop.`;
}

describe("Props drilling policy", () => {
  it.effect(
    "rejects a prop handed unchanged to components of the module or app",
    () =>
      Effect.gen(function* () {
        const violations = yield* inspect(`
import { TableSearch } from "@/components/exams/results/filter";
const Panel = lazy(() => import("@/components/panel"));
const Loose = lazy(load);
const Computed = lazy(() => import(path));
function Row({ label }: { label: string }) {
  return <p>{label}</p>;
}
export function Filters({ search, slug, tone: color }: Props) {
  return (
    <div>
      <TableSearch value={search} />
      <Row label={slug} />
      <Row label={color} />
      <Results.Table slug={slug} />
    </div>
  );
}
export const Card = memo(function Card({ title }: { title: string }) {
  return <Row label={title} key={title} />;
});
export function renderOption({ id }: { id: string }) {
  return <Option id={id} />;
}
export function Labelled({ "aria-label": label }: Props) {
  return <Row label={label} />;
}
export function Lazy({ open }: Props) {
  return <><Panel open={open} /><Loose open={open} /><Computed open={open} /></>;
}`);
        assert.deepStrictEqual(violations, [
          drilled("Filters", "search", "TableSearch"),
          drilled("Filters", "slug", "Row and Results.Table"),
          drilled("Filters", "tone", "Row"),
          drilled("renderOption", "id", "Option"),
          drilled("Labelled", "aria-label", "Row"),
          drilled("Lazy", "open", "Panel and Loose and Computed"),
        ]);
      })
  );

  it.effect("rejects props read only to be handed on by member", () =>
    Effect.gen(function* () {
      const violations = yield* inspect(`
export function Chats(props: Props) {
  return props.live ? <LiveChats first={props.first} /> : <StaticChats first={props.first} />;
}`);
      assert.deepStrictEqual(violations, [
        drilled("Chats", "first", "LiveChats and StaticChats"),
      ]);
    })
  );

  it.effect(
    "allows props a component reads, places, or gives to a primitive",
    () =>
      Effect.gen(function* () {
        const violations = yield* inspect(`
import { Button } from "@repo/design-system/components/ui/button";
import Html from "react-email";
import { ClassesPreloadContext } from "@/components/tenant/classes/preload";
import { PlayerProvider } from "@/components/player/provider";
import * as Motion from "motion/react";
const Pictures = createContext(null);
const Theme = React.createContext("light");
const plain = 1;
const { shared } = settings;
const Stage = lazy(() =>
  import("@repo/design-system/components/stage").then((module) => ({ default: module.Stage }))
);
const curried = make()();
function Row({ label }: { label: string }) {
  return <p>{label}</p>;
}
export function Screen({ children, classes, count, href, item, locale, mode, onPress, pictures, preload, theme, title }: Props) {
  const total = count + 1;
  const { title: heading } = copy;
  return (
    <ClassesPreloadContext value={classes}>
      <Pictures value={pictures}>
        <Theme.Provider value={theme}>
          <PlayerProvider mode={mode} />
          <Html lang={locale}>
            <a href={href}>{title}</a>
            <Button onClick={onPress}>{total}</Button>
            <Motion.div animate={item} />
            <Row key={preload} label={item.name} />
            <Row label={children} />
          </Html>
        </Theme.Provider>
      </Pictures>
    </ClassesPreloadContext>
  );
}
export function Mixed({ disabled, items, open }: Props) {
  return (
    <>
      <Row label={disabled} />
      <Button disabled={disabled} />
      {items.map((open) => <Row key={open} label={open} />)}
      <Row label={{ open: 1 }.open} />
    </>
  );
}
export function Wrapper(props: Props) {
  return <Row {...props} label={props.label} />;
}
export function Reader(props: Props) {
  return <Row label={props.label ?? "none"} />;
}
export function Staged({ view }: Props) {
  return <Stage view={view} />;
}
export function Unused({ ignored }: Props) {
  return <Row label="fixed" />;
}
export function Nested({ value: { inner }, ...rest }: Props) {
  return <Row label={inner} {...rest} />;
}
export function Pair([first]: Props) {
  return <Row label={first} />;
}
export function NoProps() {
  return <Row label="fixed" />;
}
export function Plain({ label }: Props) {
  return label;
}
declare function Declared({ label }: Props): JSX.Element;
export default function ({ tone }: Props) {
  return <this.Row tone={tone} />;
}`);
        assert.deepStrictEqual(violations, []);
      })
  );

  it.effect("inspects authored TSX modules outside the component sets", () =>
    Effect.gen(function* () {
      const source =
        "export function Item({ label }: Props) { return <Row label={label} />; }";
      const violations = yield* Effect.all([
        inspect(source, "packages/design-system/components/ui/item.tsx"),
        inspect(source, "packages/design-system/components/evilcharts/x.tsx"),
        inspect(source, "apps/www/src/lib/example.ts"),
      ]);
      assert.deepStrictEqual(violations, [[], [], []]);
    })
  );
});
