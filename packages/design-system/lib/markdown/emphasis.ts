import { cva } from "class-variance-authority";

/**
 * Styling for an authored emphasis phrase.
 *
 * `**` and `<Highlight>` mark the same thing: the phrase a learner should carry
 * out of the section. Both render as `<strong>` from this one variant map, so
 * the authoring choice is about which syntax reads best at that point in the
 * source and never about a different result for the learner.
 *
 * `variant` chooses the surface. `warning` is the default because a marked
 * phrase still has to be learned. `success` marks a phrase whose condition the
 * learner has already met, such as a satisfied requirement or a completed step.
 * Math needs an inline block so the surface encloses tall matrices and fractions;
 * ordinary phrases keep their cloned inline decoration when wrapping.
 *
 * Everything inside the phrase reads in the surface's own text colour: math,
 * a bolder or slanted word and a sub- or superscript inherit it, and a link
 * takes it too, instead of the page's link colour, which on the surface's fill
 * reads poorly in light and not at all in dark. A link is an `<a>`, or, in the
 * saved words that stand in for an editor, a `[data-link]` that holds no
 * address. The link keeps its underline as its cue. Inline code keeps its own
 * muted chip, which carries its own pair.
 *
 * A note's highlight and an exam's bold phrase are this same marked phrase, so
 * the memory editor and the exam document give their marks these classes.
 */
export const emphasisVariants = cva(
  "rounded-sm box-decoration-clone p-1 font-[weight:inherit] has-[.katex]:inline-block [&_:is(a,[data-link])]:text-inherit",
  {
    variants: {
      variant: {
        success: "bg-success text-success-foreground",
        warning: "bg-warning text-warning-foreground",
      },
    },
    defaultVariants: {
      variant: "warning",
    },
  }
);
