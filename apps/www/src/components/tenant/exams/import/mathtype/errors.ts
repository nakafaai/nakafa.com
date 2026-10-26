import { Schema } from "effect";

/**
 * Why the import keeps a MathType equation as a picture: the reader could not be loaded, its
 * object is no compound file that holds an equation, the equation is older than MathType 4, its
 * bytes end early or hold a record the format does not define, or it draws a template, character
 * or mark that this reader cannot write as LaTeX without changing the mathematics.
 */
export class MathTypeUnread extends Schema.TaggedError<MathTypeUnread>()(
  "MathTypeUnread",
  {
    reason: Schema.Literals([
      "unloaded",
      "ole",
      "version",
      "truncated",
      "record",
      "unsupported",
    ]),
  }
) {}
