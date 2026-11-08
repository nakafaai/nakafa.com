import { cva } from "class-variance-authority";

/**
 * The room of a marker beside words, such as a number, a circle, a check box, a dot, an icon or an icon button: one
 * line of the words high, so the marker stands on the middle of their first line however many lines they wrap to.
 * The row around it lays its parts from the top. `end` lays the room over the end of the words' first line, as a
 * control that shows on hover does.
 */
export const lineMark = cva("flex h-lh shrink-0 items-center", {
  defaultVariants: { place: "flow" },
  variants: {
    place: {
      end: "absolute end-0 top-0",
      flow: "",
    },
  },
});
