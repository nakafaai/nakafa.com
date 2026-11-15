import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { parseSources } from "#scripts/check/source";
import { inspectVisualSource } from "#scripts/check/visuals";

const VISUAL = "packages/design-system/components/contents/example.tsx";
const HEADLESS =
  "a VisualCard has no VisualCardHeader. Every visual names what it shows: draw a VisualCardHeader with its title and description first in the card, or in what a frame that places its children receives.";

/** Inspects one module with the visual card policy alone. */
function inspect(sourceText: string, file = VISUAL) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectVisualSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Visual card source policy", () => {
  it.effect(
    "rejects a card without a header and a header without its words",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Scene({ children }) {
  return (
    <>
      <VisualCard><VisualCardBody /></VisualCard>
      <VisualCard>
        <VisualCardHeader title={title} />
        <VisualCardBody />
      </VisualCard>
      <VisualCardHeader description={description} />
    </>
  );
}`),
          [
            `${VISUAL}:5: a VisualCard has no VisualCardHeader. Every visual names what it shows: draw a VisualCardHeader with its title and description first in the card, or in what a frame that places its children receives.`,
            `${VISUAL}:7: a VisualCardHeader has no description. Every visual's header takes its title and its description.`,
            `${VISUAL}:10: a VisualCardHeader has no title. Every visual's header takes its title and its description.`,
          ]
        );
      })
  );

  it.effect(
    "judges a frame that places its children at each usage, which writes the header",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
function UnitCircleFrame({ children }) {
  return (
    <VisualCard>
      {children}
      <Content />
    </VisualCard>
  );
}
export function UnitCircle({ description, title }) {
  return (
    <UnitCircleFrame>
      <VisualCardHeader description={description} title={title} />
    </UnitCircleFrame>
  );
}
export function UnitCircleCard() {
  return <UnitCircleFrame>{header}</UnitCircleFrame>;
}
export default function () {
  return <VisualCard>{children}</VisualCard>;
}
const frame = ({ children }) => <VisualCard>{children}</VisualCard>;`),
          [
            `${VISUAL}:18: ${HEADLESS}`,
            `${VISUAL}:21: ${HEADLESS}`,
            `${VISUAL}:23: ${HEADLESS}`,
          ]
        );
      })
  );

  it.effect(
    "accepts a card that names what it shows, and a module the rule does not judge",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Scene() {
  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody />
    </VisualCard>
  );
}`),
          []
        );
        assert.deepStrictEqual(
          yield* inspect(
            "export const card = <VisualCard />;",
            "packages/design-system/components/visual/example.ts"
          ),
          []
        );
      })
  );
});
