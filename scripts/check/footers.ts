import { Array as Arr, HashSet, Option } from "effect";
import type { Node, SourceFile } from "tsrs/ast";
import { isJsxElement } from "tsrs/ast";
import type { Component } from "#scripts/check/components";
import {
  componentGraph,
  componentKey,
  rootsOf,
} from "#scripts/check/components";
import { nodesBelow } from "#scripts/check/drilling";
import { attributeValue, classText, opening } from "#scripts/check/jsx";
import { place } from "#scripts/check/places";
import { children } from "#scripts/check/source";

/** The pane frame module that owns `PaneFooter`. */
const PANE_MODULE = "apps/www/src/components/shared/page/pane.tsx";
const PANE_FOOTER_TAG = "PaneFooter";
/** The shared player footer bar that wraps `PaneFooter`. */
const PLAYER_TOOLS_MODULE =
  "apps/www/src/components/player/navigator/tools.tsx";
const PLAYER_TOOLS_TAG = "PlayerTools";
/** The player pane and sheet components whose `footer` prop renders inside `PaneFooter`. */
const FOOTER_PROP_MODULES = HashSet.make(
  "apps/www/src/components/player/navigator/sidebar.tsx",
  "apps/www/src/components/player/navigator/sheet.tsx"
);
const FOOTER_PROP_TAGS = HashSet.make("PlayerSidebar", "PlayerSheet");
const FOOTER_PROP_NAME = "footer";
/** Prose and heading elements that never belong in a single-row pane footer bar. */
const PROSE_TAGS = HashSet.make("p", "h1", "h2", "h3", "h4", "h5", "h6");
/** Overlay components whose content renders in a portal outside the footer row. */
const OVERLAY_TAG_PATTERN = /(?:Content|Popup|Dialog|Sheet|Drawer)$/u;
/** Tailwind `flex-wrap`, which turns a pane footer into a broken multi-row bar. */
const FLEX_WRAP_PATTERN = /(?:^|\s)flex-wrap(?:\s|$)/u;

interface Owner {
  readonly file: string;
  readonly sourceFile: SourceFile;
}

type Resolve = (file: string, tag: string) => Option.Option<Component>;

/** Whether a tag in `file` refers to the named component in one of the expected modules. */
function isOwnedTag(
  file: string,
  tag: string | undefined,
  resolve: Resolve,
  expectedModules: HashSet.HashSet<string>,
  expectedTags: HashSet.HashSet<string>
) {
  if (tag === undefined || !HashSet.has(expectedTags, tag)) {
    return false;
  }
  return (
    HashSet.has(expectedModules, file) ||
    Option.exists(resolve(file, tag), (target) =>
      HashSet.has(expectedModules, target.file)
    )
  );
}

/** Walks every JSX node that renders inside a pane footer bar, skipping portal overlays. */
function inspectFooterNode(
  node: Node,
  owner: Owner,
  resolve: Resolve,
  visited: HashSet.HashSet<string>
): readonly string[] {
  const opened = opening(node);
  if (Option.isSome(opened)) {
    const { attributes, tag } = opened.value;
    const name = tag ?? "";
    if (OVERLAY_TAG_PATTERN.test(name)) {
      return [];
    }
    const own = Arr.flatten([
      HashSet.has(PROSE_TAGS, name)
        ? [
            `${place(owner.file, owner.sourceFile, node)}: a pane footer holds controls alone, never prose <${name}>.`,
          ]
        : [],
      Option.exists(classText(attributes), (text) =>
        FLEX_WRAP_PATTERN.test(text)
      )
        ? [
            `${place(owner.file, owner.sourceFile, node)}: a pane footer stays on one row; remove flex-wrap.`,
          ]
        : [],
    ]);
    const nested = Option.match(resolve(owner.file, name), {
      onNone: () => [],
      onSome: (target) => {
        const key = componentKey(target);
        if (HashSet.has(visited, key)) {
          return [];
        }
        const nextVisited = HashSet.add(visited, key);
        return Arr.flatMap(rootsOf(target), (root) =>
          inspectFooterNode(root, target, resolve, nextVisited)
        );
      },
    });
    const inside = Arr.flatMap(children(node), (child) =>
      inspectFooterNode(child, owner, resolve, visited)
    );
    return Arr.flatten([own, nested, inside]);
  }
  return Arr.flatMap(children(node), (child) =>
    inspectFooterNode(child, owner, resolve, visited)
  );
}

const FOOTER_CHILDREN_MODULES = HashSet.make(PANE_MODULE, PLAYER_TOOLS_MODULE);
const FOOTER_CHILDREN_TAGS = HashSet.make(PANE_FOOTER_TAG, PLAYER_TOOLS_TAG);

/**
 * Enforces single-row, control-only pane footers across the app: `PaneFooter` itself and any content placed
 * inside `<PaneFooter>`, `<PlayerTools>`, or the `footer` prop of `PlayerSidebar` / `PlayerSheet` must never
 * use `flex-wrap` or render prose/heading elements (`<p>`, `<h1>`-`<h6>`).
 */
export function inspectPaneFooters(
  modules: Parameters<typeof componentGraph>[0]
) {
  const { components, resolve } = componentGraph(modules);
  const findings = Arr.flatMap(components, (component) => {
    const ownFooter =
      component.file === PANE_MODULE && component.name === PANE_FOOTER_TAG
        ? Arr.flatMap(rootsOf(component), (root) =>
            inspectFooterNode(
              root,
              component,
              resolve,
              HashSet.make(componentKey(component))
            )
          )
        : [];
    const slotFindings = Arr.flatMap(nodesBelow(component.body), (node) =>
      Option.match(opening(node), {
        onNone: () => [],
        onSome: ({ attributes, tag }) => {
          if (
            isJsxElement(node) &&
            isOwnedTag(
              component.file,
              tag,
              resolve,
              FOOTER_CHILDREN_MODULES,
              FOOTER_CHILDREN_TAGS
            )
          ) {
            return Arr.flatMap(node.children, (child) =>
              inspectFooterNode(
                child,
                component,
                resolve,
                HashSet.make(componentKey(component))
              )
            );
          }
          if (
            isOwnedTag(
              component.file,
              tag,
              resolve,
              FOOTER_PROP_MODULES,
              FOOTER_PROP_TAGS
            )
          ) {
            return Option.match(attributeValue(attributes, FOOTER_PROP_NAME), {
              onNone: () => [],
              onSome: (value) =>
                inspectFooterNode(
                  value,
                  component,
                  resolve,
                  HashSet.make(componentKey(component))
                ),
            });
          }
          return [];
        },
      })
    );
    return Arr.appendAll(ownFooter, slotFindings);
  });
  return Arr.dedupe(findings);
}
