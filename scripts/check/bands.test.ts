import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectBandSource } from "#scripts/check/bands";
import { parseSources } from "#scripts/check/source";

const VISUAL = "packages/design-system/components/contents/example.tsx";
const RULE =
  "The toolbar and the actions band hold only the visual's controls and buttons, each with its own label and value: put a legend, a key, a readout or a note in VisualCardFooter, and what the reader should do in the header's description.";

/** Inspects one module with the band policy alone. */
function inspect(sourceText: string, file = VISUAL) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectBandSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Visual card band policy", () => {
  it.effect("rejects a legend, a note and words in a control band", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
export function Sort({ sets }) {
  return (
    <VisualCard>
      <VisualCardToolbar>
        <ToggleGroup />
        <ul>{sets.map((set) => <li key={set}>{set}</li>)}</ul>
        <InlineMath math="A" />
        <div><span>Drag a hoop</span></div>
      </VisualCardToolbar>
      <VisualCardActions>
        Press play
        {"to start"}
        <VisualCardPlay />
      </VisualCardActions>
    </VisualCard>
  );
}`),
        [
          `${VISUAL}:7: a VisualCardToolbar holds <ul>, which shows text and no control. ${RULE}`,
          `${VISUAL}:8: a VisualCardToolbar holds <InlineMath>, which shows text and no control. ${RULE}`,
          `${VISUAL}:9: a VisualCardToolbar holds <div>, which holds no control. ${RULE}`,
          `${VISUAL}:12: a VisualCardActions writes text straight into the band. ${RULE}`,
          `${VISUAL}:13: a VisualCardActions writes text straight into the band. ${RULE}`,
        ]
      );
    })
  );

  it.effect("finds a text block grouped with a control", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(`
export function Hoops({ open }) {
  return (
    <VisualCardToolbar>
      <div>
        <Slider />
        <p>Slide to grow the hoop.</p>
      </div>
      {open && (
        <ToggleGroup>
          <HoopLegend />
        </ToggleGroup>
      )}
    </VisualCardToolbar>
  );
}`),
        [
          `${VISUAL}:7: a VisualCardToolbar holds <p>, which shows text and no control. ${RULE}`,
          `${VISUAL}:11: a VisualCardToolbar holds <HoopLegend>, which shows text and no control. ${RULE}`,
        ]
      );
    })
  );

  it.effect(
    "accepts controls, labelled sliders and controls behind a condition or in a list",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Lab({ labels, parameters, presets, value }) {
  return (
    <VisualCard>
      <VisualCardToolbar>
        <div>
          <div>
            <span>{labels.speed}</span>
            <span><InlineMath math={value} /></span>
          </div>
          <Slider aria-label={labels.speed} />
        </div>
        <ToggleGroup>
          <ToggleGroupItem><InlineMath math="A \\cap B" /></ToggleGroupItem>
        </ToggleGroup>
        {presets ? <ToggleGroup /> : null}
        {parameters.map((parameter) => <LabSlider key={parameter} />)}
        <>
          <Labeled label={labels.year}><Slider /></Labeled>
        </>
        <label><input type="checkbox" /> {labels.trace}</label>
        <button type="button">{labels.reset}</button>
        {labels.extra}
      </VisualCardToolbar>
      <VisualCardActions>
        <VisualCardPlay />
        <VisualCardMenu />
      </VisualCardActions>
      <VisualCardActions />
    </VisualCard>
  );
}`),
          []
        );
      })
  );

  it.effect("leaves modules outside the markup rules alone", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(
          "export const band = <VisualCardToolbar><p>Note</p></VisualCardToolbar>;",
          "packages/design-system/components/ui/example.tsx"
        ),
        []
      );
    })
  );
});
