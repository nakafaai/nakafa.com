import { Array as Arr, Option } from "effect";
import { isStringLiteralLikeNode, type SourceFile } from "tsrs/ast";
import { nodesBelow } from "#scripts/check/drilling";
import { classText, opening } from "#scripts/check/jsx";
import { TEST_PATTERN } from "#scripts/check/kinds";

/** The one module that draws a Hugeicons icon, and owns its sizes. */
const ICON_MODULE = "packages/design-system/components/ui/huge-icons.tsx";
/** A class that sizes an element: a square, a height or a width, at any breakpoint or state. */
const SIZE_CLASS_PATTERN =
  /(?:^|\s|:)(?:size|h|w|min-h|min-w|max-h|max-w)-[^\s]+/u;
/** A class that sizes the icons inside an element: its value is what the icon becomes. */
const ICON_SIZE_PATTERN = /svg[^\s]*:size-\d+(?:\.\d+)?(?=\s|$)/gu;
/** The text before a size step. */
const SIZE_PREFIX = "size-";
/** The largest icon, `size-4`, in Tailwind's spacing steps. */
const LARGEST_STEP = 4;

/**
 * Reports an icon drawn outside the design system's one icon component or at a size that component does not offer.
 * An icon is `size-4` at most: `HugeIcons` takes its size from its `size` step and never from a class, the Hugeicons
 * renderer is only drawn inside `HugeIcons`, and no class sizes the icons inside an element above `size-4`. A picture
 * that needs more room is drawn artwork, never a bigger icon. Test modules are not judged.
 */
export function inspectIconSource(file: string, sourceFile: SourceFile) {
  if (TEST_PATTERN.test(file) || !file.endsWith(".tsx")) {
    return [];
  }
  const nodes = nodesBelow(sourceFile);
  const elements = Arr.flatMap(nodes, (node) =>
    Option.match(opening(node), {
      onNone: () => [],
      onSome: ({ attributes, tag }) => {
        if (tag === "HugeiconsIcon" && file !== ICON_MODULE) {
          return [
            `${file}: an icon is drawn with HugeiconsIcon. Draw every icon with HugeIcons, which owns its sizes.`,
          ];
        }
        const sized =
          tag === "HugeIcons" &&
          Option.exists(classText(attributes), (classes) =>
            SIZE_CLASS_PATTERN.test(classes)
          );
        return sized
          ? [
              `${file}: a HugeIcons class sizes the icon. An icon is size-4 at most and takes its size from the size prop alone ("2xs", "xs", "sm", or the default size-4).`,
            ]
          : [];
      },
    })
  );
  const descendants = Arr.flatMap(nodes, (node) =>
    isStringLiteralLikeNode(node) &&
    Arr.some(
      Arr.fromIterable(node.text.matchAll(ICON_SIZE_PATTERN)),
      (match) =>
        Number(
          match[0].slice(match[0].lastIndexOf(SIZE_PREFIX) + SIZE_PREFIX.length)
        ) > LARGEST_STEP
    )
      ? [
          `${file}: a class sizes the icons inside an element above size-4. An icon is size-4 at most; a picture that needs more room is drawn artwork.`,
        ]
      : []
  );
  return Arr.appendAll(elements, descendants);
}
