import { Number as Num, Option, String as Str } from "effect";

/**
 * The style properties that decide where the text of a textarea wraps, which the
 * mirror copies so its text breaks where the field's text breaks.
 */
const MIRRORED = [
  "border-bottom-width",
  "border-left-width",
  "border-right-width",
  "border-top-width",
  "box-sizing",
  "direction",
  "font-family",
  "font-size",
  "font-stretch",
  "font-style",
  "font-variant",
  "font-weight",
  "letter-spacing",
  "line-height",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "tab-size",
  "text-indent",
  "text-transform",
  "width",
  "word-spacing",
];

/**
 * The rectangle of the caret in a textarea, in viewport pixels, as a virtual
 * anchor reports it. A textarea offers no caret rectangle of its own, so a hidden
 * mirror with the field's text style lays out the text before the caret, and a
 * marker after it stands where the caret is. The mirror leaves the page at once.
 */
export const caretRect = (field: HTMLTextAreaElement, position: number) => {
  const document = field.ownerDocument;
  const style = window.getComputedStyle(field);
  const mirror = document.createElement("div");
  for (const property of MIRRORED) {
    mirror.style.setProperty(property, style.getPropertyValue(property));
  }
  mirror.style.setProperty("position", "absolute");
  mirror.style.setProperty("visibility", "hidden");
  mirror.style.setProperty("white-space", "pre-wrap");
  mirror.style.setProperty("overflow-wrap", "break-word");
  mirror.style.setProperty("top", "0");
  mirror.style.setProperty("left", "0");
  mirror.textContent = field.value.slice(0, position);
  const marker = document.createElement("span");
  // The marker holds the text after the caret, so it wraps as the field does; an empty rest still needs a box.
  marker.textContent = field.value.slice(position) || ".";
  mirror.append(marker);
  document.body.append(mirror);
  const box = field.getBoundingClientRect();
  const top = box.top + marker.offsetTop - field.scrollTop;
  const left = box.left + marker.offsetLeft - field.scrollLeft;
  // A line height in pixels, such as `24px`, is the caret's height; `normal` is the marker's own.
  const height = Option.getOrElse(
    Num.parse(Str.replace("px", "")(style.lineHeight)),
    () => marker.offsetHeight
  );
  mirror.remove();
  return {
    bottom: top + height,
    height,
    left,
    right: left,
    top,
    width: 0,
    x: left,
    y: top,
  };
};
