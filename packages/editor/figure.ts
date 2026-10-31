import { type AnyExtension, Node, type NodeViewRenderer } from "@tiptap/core";
import { Array as Arr, Option, Schema } from "effect";

/** An attribute that holds a JSON value, which the DOM keeps as JSON text. */
const JsonText = Schema.fromJsonString(Schema.Json);

/** The DOM attribute that keeps one attribute of a figure, such as `data-alt`. */
const DATA = (name: string) => `data-${name}`;

/** A text attribute of a figure, which the DOM keeps as a `data-` attribute of the same name. */
const textAttribute = (name: string) => ({
  default: "",
  parseHTML: (element: HTMLElement) => element.getAttribute(DATA(name)) ?? "",
  renderHTML: (attributes: Record<string, unknown>) => ({
    [DATA(name)]: attributes[name],
  }),
});

/** A JSON attribute of a figure, which takes `fallback` from markup that holds none. */
const jsonAttribute = (name: string, fallback: typeof Schema.Json.Type) => ({
  default: fallback,
  parseHTML: (element: HTMLElement) =>
    Option.getOrElse(
      Schema.decodeUnknownOption(JsonText)(element.getAttribute(DATA(name))),
      () => fallback
    ),
  renderHTML: (attributes: Record<string, unknown>) => ({
    [DATA(name)]: Schema.encodeUnknownSync(JsonText)(attributes[name]),
  }),
});

/**
 * A figure of a document, written as the contract's `figure` block: the component that draws it, that
 * component's props, its text alternative, and its caption (ADR 0031). Only the markup this editor writes is
 * read back. It is an atom, so a step moves it whole, and the view that draws it is the caller's.
 */
const FigureBlock = Node.create<{ view: NodeViewRenderer | null }>({
  name: "figure",
  addAttributes() {
    return {
      alt: textAttribute("alt"),
      caption: jsonAttribute("caption", null),
      component: textAttribute("component"),
      props: jsonAttribute("props", {}),
    };
  },
  addNodeView() {
    return this.options.view;
  },
  addOptions() {
    return { view: null };
  },
  atom: true,
  group: "block",
  parseHTML() {
    return [{ tag: 'figure[data-type="figure"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["figure", { ...HTMLAttributes, "data-type": "figure" }];
  },
  selectable: true,
});

/** The figure of a document, drawn by the given view, which is `null` when the caller draws none. */
export function figureExtensions(
  view: NodeViewRenderer | null
): AnyExtension[] {
  return Arr.make(FigureBlock.configure({ view }));
}
