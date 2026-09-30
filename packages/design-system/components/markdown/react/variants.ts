import { cva } from "class-variance-authority";

/** The box that holds a response's code, highlighted or as plain text. */
export const codeFenceBodyVariants = cva("overflow-x-auto border-t");

/** The code's lines inside that box. */
export const codeFencePreVariants = cva(
  "overflow-x-auto bg-muted/40 p-4 font-mono text-sm"
);
