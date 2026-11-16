import {
  Array as Arr,
  Number as Num,
  Option,
  Result,
  String as Str,
} from "effect";
import { isStringLiteralLikeNode, type SourceFile } from "tsrs/ast";
import { nodesBelow } from "#scripts/check/drilling";
import {
  attributeValue,
  classText,
  judgesMarkup,
  opening,
} from "#scripts/check/jsx";
import { place } from "#scripts/check/places";

/** The module of the container every EvilCharts chart draws in, and the slot of its root element. */
const CONTAINER_MODULE =
  "packages/design-system/components/evilcharts/ui/chart.tsx";
const CHART_SLOT = "chart";
/** What draws a chart: an EvilCharts chart, such as `EvilBarChart`, or the container they all draw in. */
const CHART_TAG_PATTERN = /^(?:Evil\w*Chart|ChartContainer)$/u;
/** A maximum height on Tailwind's scale or a value of its own, after any variant, such as `max-h-96`. */
const CAP_PATTERN = /(?<=^|[\s:])max-h-(?!none(?:\s|$))\S+/u;
/** The utility that sets a maximum height, after any variant, such as `max-h-80` in `md:max-h-80`. */
const CAP_PREFIX = "max-h-";
/** A chart may lower the container's cap of `max-h-96` to a smaller step of the scale, never lift or replace it. */
const CONTAINER_STEP = 96;
const CLASS_SEPARATOR = /\s+/u;
const VARIANT_SEPARATOR = ":";

/** The caps a class text writes that the container's own does not hold: `none`, a larger step, or a value of its own. */
function liftedCaps(classes: string) {
  return Arr.filterMap(Str.split(classes, CLASS_SEPARATOR), (token) => {
    const utility = Arr.lastNonEmpty(Str.split(token, VARIANT_SEPARATOR));
    if (!utility.startsWith(CAP_PREFIX)) {
      return Result.failVoid;
    }
    return Option.exists(
      Num.parse(utility.slice(CAP_PREFIX.length)),
      (step) => step <= CONTAINER_STEP
    )
      ? Result.failVoid
      : Result.succeed(utility);
  });
}

/**
 * Reports a chart that can grow taller than the window. A chart keeps its aspect as it widens, so a square chart on a
 * wide card grows taller than the screen and its axis leaves it. The container that every chart draws in caps its own
 * height, its root (`data-slot="chart"`) keeps a `max-h-` class, and no chart lifts the cap: a chart may lower it to a
 * smaller step of the scale, never write `max-h-none`, a larger step or a value of its own.
 */
export function inspectChartSource(file: string, sourceFile: SourceFile) {
  const nodes = nodesBelow(sourceFile);
  if (file === CONTAINER_MODULE) {
    return Arr.filterMap(nodes, (node) =>
      Option.match(opening(node), {
        onNone: () => Result.failVoid,
        onSome: ({ attributes }) =>
          Option.exists(
            attributeValue(attributes, "data-slot"),
            (slot) => isStringLiteralLikeNode(slot) && slot.text === CHART_SLOT
          ) &&
          !Option.exists(classText(attributes), (classes) =>
            CAP_PATTERN.test(classes)
          )
            ? Result.succeed(
                `${place(file, sourceFile, node)}: the chart container has no maximum height. Keep a cap on its root, such as max-h-96, so no chart grows taller than the window.`
              )
            : Result.failVoid,
      })
    );
  }
  if (!judgesMarkup(file)) {
    return [];
  }
  return Arr.filterMap(nodes, (node) =>
    Option.match(opening(node), {
      onNone: () => Result.failVoid,
      onSome: ({ attributes, tag }) =>
        tag !== undefined && CHART_TAG_PATTERN.test(tag)
          ? Option.match(
              Option.flatMap(classText(attributes), (classes) =>
                Arr.head(liftedCaps(classes))
              ),
              {
                onNone: () => Result.failVoid,
                onSome: (cap) =>
                  Result.succeed(
                    `${place(file, sourceFile, node)}: ${tag} lifts the chart's maximum height with ${cap}. ChartContainer caps every chart at max-h-96: drop the class, or lower the cap with a smaller step, such as max-h-80.`
                  ),
              }
            )
          : Result.failVoid,
    })
  );
}
