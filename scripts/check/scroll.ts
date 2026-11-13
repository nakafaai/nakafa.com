import { Array as Arr, HashSet, Option, Result } from "effect";
import { isStringLiteralLikeNode, type Node, type SourceFile } from "tsrs/ast";
import { nodesBelow } from "#scripts/check/drilling";
import {
  attributeValue,
  classText,
  judgesMarkup,
  opening,
} from "#scripts/check/jsx";
import { place } from "#scripts/check/places";

/** The design system's overlays, whose bodies scroll in a ScrollArea between their header and footer. */
const OVERLAY_MODULES = HashSet.make(
  "packages/design-system/components/ui/dialog.tsx",
  "packages/design-system/components/ui/drawer.tsx",
  "packages/design-system/components/ui/sheet.tsx"
);
/** The surfaces that lay over a page: a dialog, which is a drawer on a phone, a sheet and a drawer. */
const OVERLAY_TAGS = HashSet.make(
  "AlertDialogContent",
  "DialogContent",
  "DrawerContent",
  "ResponsiveDialog",
  "SheetContent"
);
/** A class that lets an element scroll sideways: `overflow-x-auto`, `overflow-auto`, and their `scroll` forms. */
const SIDEWAYS_PATTERN =
  /(?<=^|[\s:])(?<utility>overflow(?:-x)?-(?:auto|scroll))(?=\s|$)/u;
const AREA_TAG = "ScrollArea";
const BAR_TAG = "ScrollBar";

/** Whether an attribute holds one quoted value, such as `axis="vertical"`. */
function names(node: Node, name: string, value: string) {
  return Option.exists(
    Option.flatMap(opening(node), ({ attributes }) =>
      attributeValue(attributes, name)
    ),
    (written) => isStringLiteralLikeNode(written) && written.text === value
  );
}

/** What lets one element of an overlay scroll sideways, or none when it scrolls only downwards. */
function sideways(node: Node) {
  return Option.flatMap(opening(node), ({ attributes, tag }) => {
    if (tag === AREA_TAG && !names(node, "axis", "vertical")) {
      return Option.some('a ScrollArea without axis="vertical"');
    }
    if (tag === BAR_TAG && names(node, "orientation", "horizontal")) {
      return Option.some("a horizontal ScrollBar");
    }
    return Option.map(
      Option.flatMap(classText(attributes), (classes) =>
        Option.fromNullishOr(SIDEWAYS_PATTERN.exec(classes)?.groups)
      ),
      ({ utility }) => utility
    );
  });
}

/**
 * The parts of a module that hold what an overlay shows: every ScrollArea of a design-system overlay module, and what
 * an overlay element holds in application code.
 */
function overlayParts(file: string, nodes: readonly Node[]) {
  if (HashSet.has(OVERLAY_MODULES, file)) {
    return Arr.filter(nodes, (node) =>
      Option.exists(opening(node), ({ tag }) => tag === AREA_TAG)
    );
  }
  if (!judgesMarkup(file)) {
    return [];
  }
  return Arr.flatMap(nodes, (node) =>
    Option.exists(
      opening(node),
      ({ tag }) => tag !== undefined && HashSet.has(OVERLAY_TAGS, tag)
    )
      ? nodesBelow(node)
      : []
  );
}

/**
 * Reports what lets a dialog, a sheet or a drawer scroll sideways. A phone shows an overlay at the screen's width, and a
 * sideways scroll there shifts every field and clips its label. An overlay of the design system scrolls its body only
 * downwards, so each ScrollArea it draws takes `axis="vertical"`, and what an overlay holds wraps, truncates or stacks:
 * no ScrollArea that scrolls both ways, no horizontal ScrollBar, and no `overflow-x-auto` or `overflow-auto`.
 */
export function inspectScrollSource(file: string, sourceFile: SourceFile) {
  const nodes = nodesBelow(sourceFile);
  return Arr.dedupe(
    Arr.filterMap(overlayParts(file, nodes), (node) =>
      Option.match(sideways(node), {
        onNone: () => Result.failVoid,
        onSome: (cause) =>
          Result.succeed(
            `${place(file, sourceFile, node)}: ${cause} lets an overlay scroll sideways. A dialog, a sheet or a drawer scrolls only downwards: give its ScrollArea axis="vertical", and wrap, truncate or stack what it holds.`
          ),
      })
    )
  );
}
