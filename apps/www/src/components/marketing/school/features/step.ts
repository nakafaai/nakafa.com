import { cva } from "class-variance-authority";

/**
 * One row of a School demo, which rises into place as it scrolls in, a little
 * after the row before it, so the demo fills itself while the reader arrives
 * (`rise-on-scroll`: the scroll drives it, and reduced motion keeps it still).
 */
export const stepVariants = cva("rise-on-scroll", {
  variants: {
    step: {
      1: "[--rise-delay:15%]",
      2: "[--rise-delay:25%]",
      3: "[--rise-delay:35%]",
      4: "[--rise-delay:45%]",
      5: "[--rise-delay:55%]",
      6: "[--rise-delay:65%]",
    },
  },
});
