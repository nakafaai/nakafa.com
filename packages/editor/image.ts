import { type AnyExtension, Node, type NodeViewRenderer } from "@tiptap/core";
import { Array as Arr, Schema } from "effect";

/** The most bytes one image of an exam may hold: 2 MB. The editor refuses a larger file, and the server checks it again. */
export const IMAGE_BYTE_LIMIT = 2 * 1024 * 1024;

/** The kinds of image an exam holds, which a file's leading bytes name and the editor accepts. */
export const ImageType = Schema.Literals([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

/** The DOM attribute that keeps one attribute of an image node, such as `data-alt`. */
const DATA = (name: string) => `data-${name}`;

/** A text attribute of an image, which the DOM keeps as a `data-` attribute of the same name. */
const textAttribute = (name: string) => ({
  default: "",
  parseHTML: (element: HTMLElement) => element.getAttribute(DATA(name)) ?? "",
  renderHTML: (attributes: Record<string, string | number>) => ({
    [DATA(name)]: attributes[name],
  }),
});

/** A size of an image in pixels, a positive whole number, which the DOM keeps as text. */
const sizeAttribute = (name: string) => ({
  default: 1,
  parseHTML: (element: HTMLElement) => {
    const size = Number.parseInt(element.getAttribute(DATA(name)) ?? "", 10);
    return size > 0 ? size : 1;
  },
  renderHTML: (attributes: Record<string, string | number>) => ({
    [DATA(name)]: attributes[name],
  }),
});

/**
 * An image of an exam, written as the contract's `image` block with its alt text, its asset
 * ID, and its width and height in pixels (ADR 0031). Only the markup this editor writes is read
 * back, so a picture pasted from another page is not an image of the document. It is an atom,
 * so a step moves it whole, and the view that draws it is the caller's.
 */
const ImageBlock = Node.create<{ view: NodeViewRenderer | null }>({
  name: "image",
  addAttributes() {
    return {
      alt: textAttribute("alt"),
      asset: textAttribute("asset"),
      height: sizeAttribute("height"),
      width: sizeAttribute("width"),
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
    return [{ tag: 'div[data-type="image"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", { ...HTMLAttributes, "data-type": "image" }];
  },
  selectable: true,
});

/** The image of a document, drawn by the given view, which is `null` when the caller draws none. */
export function imageExtensions(view: NodeViewRenderer | null): AnyExtension[] {
  return Arr.make(ImageBlock.configure({ view }));
}
