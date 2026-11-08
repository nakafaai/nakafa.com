import { Effect, Schema } from "effect";

/** p5 could not be loaded, for example when the network dropped its chunks. */
export class SketchLoadError extends Schema.TaggedError<SketchLoadError>()(
  "SketchLoadError",
  { cause: Schema.Unknown, message: Schema.String }
) {}

/**
 * Loads p5's modular core with only the shape, color, and math addons a lesson
 * sketch draws with, about a third of the full build. It loads when a sketch
 * first nears the screen, never with the page, and registers the addons once:
 * a second sketch finds them on the class already.
 */
export const loadP5 = Effect.fn("designSystem.sketch.loadP5")(function* () {
  const [core, shape, color, math] = yield* Effect.tryPromise({
    catch: (cause) =>
      new SketchLoadError({ cause, message: "p5 did not load." }),
    try: () =>
      Promise.all([
        import("p5/core"),
        import("p5/shape"),
        import("p5/color"),
        import("p5/math"),
      ]),
  });
  const P5 = core.default;
  if (!("ellipse" in P5.prototype)) {
    P5.registerAddon(shape.default);
    P5.registerAddon(color.default);
    P5.registerAddon(math.default);
  }
  return P5;
});
