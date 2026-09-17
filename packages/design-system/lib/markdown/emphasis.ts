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
 */
export const emphasisVariants = cva(
  "rounded-sm box-decoration-clone p-1 font-medium",
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
