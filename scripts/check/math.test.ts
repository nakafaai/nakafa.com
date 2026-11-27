import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectMathSource } from "#scripts/check/math";
import { parseSources } from "#scripts/check/source";

const LAB = "packages/design-system/components/contents/chemistry/demo/lab.tsx";
const MODEL =
  "packages/design-system/components/contents/chemistry/demo/model.ts";
const PLAIN_MATH_RULE =
  "plain-text exponent, arrow, or ASCII unit power belongs in <InlineMath math={...} /> instead of a raw string.";
const PLAIN_READOUT_RULE =
  "numeric or unit readout on VisualFact/VisualSlider belongs in <InlineMath math={...} /> using useQuantity() instead of a plain string.";

/** Inspects one module with the math-expression source policy alone. */
function inspect(sourceText: string, file = LAB) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectMathSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Math expression source policy", () => {
  it.effect(
    "rejects plain-text exponents, ASCII arrows, and ASCII unit powers outside KaTeX",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(
            `export function build(n: number) {
  return {
    arrow: "A -> B",
    equil: "<->",
    moleculesLabel: \`\${n} x 10^23\`,
    power: \`> 2^\${n}\`,
    unit: "24 dm3",
  };
}`,
            MODEL
          ),
          [
            `${MODEL}:3: ${PLAIN_MATH_RULE}`,
            `${MODEL}:4: ${PLAIN_MATH_RULE}`,
            `${MODEL}:5: ${PLAIN_MATH_RULE}`,
            `${MODEL}:6: ${PLAIN_MATH_RULE}`,
            `${MODEL}:7: ${PLAIN_MATH_RULE}`,
          ]
        );
      })
  );

  it.effect(
    "rejects plain-text unit and percentage readouts on VisualFact and VisualSlider",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`export function Demo({ value }: { value: number }) {
  return (
    <>
      <VisualSlider readout={\`\${value}%\`} />
      <VisualFact label="Acidity" value={\`pH \${value}\`} />
      <VisualFactTabular label="Length" value={\`\${value} mm\`} />
      <VisualFact label="Ratio" value="×2" />
    </>
  );
}`),
          [
            `${LAB}:4: ${PLAIN_READOUT_RULE}`,
            `${LAB}:5: ${PLAIN_READOUT_RULE}`,
            `${LAB}:6: ${PLAIN_READOUT_RULE}`,
            `${LAB}:7: ${PLAIN_READOUT_RULE}`,
          ]
        );
      })
  );

  it.effect(
    "allows InlineMath, BlockMath, MathLines, *Math properties, exempt attributes, and non-content/test files",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`export function Clean({ n, v }: { n: number; v: number }) {
  const row = {
    combinationsMath: \`2^{\${n}}\`,
    equation: "\\\\mathrm{Cu^{2+}} + 2e^- \\\\rightarrow \\\\mathrm{Cu}",
    math: "10^23",
    tex: "3d_{z^2}",
  };
  return (
    <>
      <InlineMath math={\`\${n} \\times 10^{23}\`} />
      <BlockMath math="A \\rightarrow B" />
      <MathLines lines={["n^0 = A - Z"]} />
      <VisualSlider aria-label="10^23" readout={<InlineMath math={\`\${v}\\%\`} />} />
      <VisualFact label="Note" value="Healthy leaf" />
      <VisualFactTabular label="Count" value={\`\${n}\`} />
      <section className="gap-2">{row.math}</section>
    </>
  );
}`),
          []
        );
        assert.deepStrictEqual(
          yield* inspect(
            `export const s = "10^23";`,
            "packages/design-system/components/contents/chemistry/demo/model.test.ts"
          ),
          []
        );
        assert.deepStrictEqual(
          yield* inspect(
            `export const s = "10^23";`,
            "packages/design-system/components/visual/example.tsx"
          ),
          []
        );
      })
  );
});
