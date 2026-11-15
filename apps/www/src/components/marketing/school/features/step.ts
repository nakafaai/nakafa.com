import { cva } from "class-variance-authority";

/**
 * One row of a School demo, which rises into place as it scrolls in, a little
 * after the row before it, so the demo fills itself while the reader arrives
 * (`rise-on-scroll`: the scroll drives it, and reduced motion keeps it still).
 * The last row rests before its card has fully entered the screen, so no row a
 * reader sees whole is ever caught half faded, as if it were disabled.
 */
export const stepVariants = cva("rise-on-scroll", {
  variants: {
    step: {
      1: "[--rise-delay:0%]",
      2: "[--rise-delay:5%]",
      3: "[--rise-delay:10%]",
      4: "[--rise-delay:15%]",
      5: "[--rise-delay:20%]",
      6: "[--rise-delay:25%]",
    },
  },
});
