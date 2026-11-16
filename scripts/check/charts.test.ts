import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectChartSource } from "#scripts/check/charts";
import { parseSources } from "#scripts/check/source";

const VISUAL = "packages/design-system/components/contents/example.tsx";
const CONTAINER = "packages/design-system/components/evilcharts/ui/chart.tsx";
const lifted = (line: number, tag: string, cap: string) =>
  `${VISUAL}:${line}: ${tag} lifts the chart's maximum height with ${cap}. ChartContainer caps every chart at max-h-96: drop the class, or lower the cap with a smaller step, such as max-h-80.`;

/** Inspects one module with the chart policy alone. */
function inspect(sourceText: string, file = VISUAL) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectChartSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("Chart source policy", () => {
  it.effect("requires the chart container to cap its own height", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* inspect(
          `
function ChartContainer({ className, footer }) {
  return (
    <div className={cn("min-h-0 w-full flex-1", !footer && "aspect-video", className)} data-slot="chart">
      <ResponsiveContainer className="min-h-0 w-full flex-1" />
    </div>
  );
}
function ChartStyle() {
  return <style data-slot={slot} />;
}`,
          CONTAINER
        ),
        [
          `${CONTAINER}:4: the chart container has no maximum height. Keep a cap on its root, such as max-h-96, so no chart grows taller than the window.`,
        ]
      );
      assert.deepStrictEqual(
        yield* inspect(
          `
function ChartContainer({ className }) {
  return <div className={cn("min-h-0 max-h-96 w-full", className)} data-slot="chart" />;
}`,
          CONTAINER
        ),
        []
      );
    })
  );

  it.effect(
    "rejects a chart that lifts the container's cap, and accepts one that lowers it",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`
export function Growth() {
  return (
    <>
      <EvilBarChart className="aspect-square md:max-h-none" config={config} />
      <ChartContainer className={cn("aspect-video", "max-h-[40rem]")} config={config} />
      <EvilAreaChart className="max-h-screen" config={config} />
      <EvilComposedChart className="max-h-120" config={config} />
      <EvilLineChart className="aspect-square max-h-80 md:max-h-96" config={config} />
      <EvilAreaChart config={config} />
      <EvilBarChart className="p-(--card-spacing)" config={config} />
      <ChartLegend className="max-h-none" />
    </>
  );
}`),
          [
            lifted(5, "EvilBarChart", "max-h-none"),
            lifted(6, "ChartContainer", "max-h-[40rem]"),
            lifted(7, "EvilAreaChart", "max-h-screen"),
            lifted(8, "EvilComposedChart", "max-h-120"),
          ]
        );
        assert.deepStrictEqual(
          yield* inspect(
            'export const chart = <EvilBarChart className="max-h-none" />;',
            "packages/design-system/components/evilcharts/charts/bar.tsx"
          ),
          []
        );
      })
  );
});
