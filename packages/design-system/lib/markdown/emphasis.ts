import { cva } from "class-variance-authority";

/**
 * Styling for an authored emphasis phrase.
 *
 * `**` and `<Highlight>` mark the same thing: the phrase a learner should hold
 * on to and scan for. Both render on the shared warning surface at the medium
 * weight, so the authoring choice is about which syntax reads best at that
 * point in the source rather than about a different treatment.
 */
export const emphasisVariants = cva(
  "rounded-sm bg-warning box-decoration-clone px-0.5 font-medium text-warning-foreground"
);
