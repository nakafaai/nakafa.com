import {
  SlashMenu,
  type SlashMenuHandle,
  type SlashMenuProps,
} from "@repo/design-system/components/editor/menu";
import { menuPlacement } from "@repo/design-system/components/editor/placement";
import {
  filterSlash,
  runSlash,
  type SlashKey,
  type SlashLabels,
} from "@repo/design-system/components/editor/slash";
import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import { Suggestion, type SuggestionProps } from "@tiptap/suggestion";

/**
 * Places the menu under the query, or over it when the window has no room below, once the editor
 * reports where the query is.
 */
function place(element: HTMLElement, rect: DOMRect | null | undefined) {
  if (!rect) {
    return;
  }
  const placement = menuPlacement(rect, window.innerHeight);
  element.style.position = "fixed";
  element.style.left = `${rect.left}px`;
  element.style.top = placement.top === null ? "" : `${placement.top}px`;
  element.style.bottom =
    placement.bottom === null ? "" : `${placement.bottom}px`;
}

/** The props of the menu for the suggestion's state: its blocks, and the pick that inserts one. */
function menuProps(
  props: SuggestionProps<SlashKey, SlashKey>,
  label: string,
  labels: SlashLabels
): SlashMenuProps {
  return { items: props.items, label, labels, select: props.command };
}

/**
 * The slash command of an editor. Typing `/` at the start of a line or after a space opens
 * the blocks it inserts, and each letter after the `/` narrows them. Escape closes the menu,
 * which the suggestion handles, and the menu lays out over the text without taking focus.
 * `label` is the menu's accessible name, and `labels` the names of its blocks.
 */
export function slashCommand({
  label,
  labels,
}: {
  label: string;
  labels: SlashLabels;
}) {
  return Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashKey, SlashKey>({
          char: "/",
          command: ({ editor, props, range }) => runSlash(props, editor, range),
          editor: this.editor,
          items: ({ query }) => filterSlash(labels, query),
          render: () => {
            let menu: ReactRenderer<SlashMenuHandle, SlashMenuProps> | null =
              null;
            return {
              onExit: () => {
                menu?.destroy();
                menu = null;
              },
              onKeyDown: ({ event }) => menu?.ref?.onKeyDown(event) ?? false,
              onStart: (props) => {
                menu = new ReactRenderer(SlashMenu, {
                  editor: props.editor,
                  props: menuProps(props, label, labels),
                });
                document.body.append(menu.element);
                place(menu.element, props.clientRect?.());
              },
              onUpdate: (props) => {
                const current = menu;
                if (current === null) {
                  return;
                }
                current.updateProps(menuProps(props, label, labels));
                place(current.element, props.clientRect?.());
              },
            };
          },
        }),
      ];
    },
  });
}
