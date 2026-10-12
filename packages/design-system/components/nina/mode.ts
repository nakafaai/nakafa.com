import type { Options } from "@repo/design-system/components/nina/figure";

/**
 * How much of her shows: all of her, her arms over an edge, or only her face in
 * a tile. It decides what moves.
 */
export function modeOf(options: Options) {
  if (options.whole === true) {
    return "whole";
  }
  return options.lean === "intip" ? "peek" : "tile";
}

/** The act that she goes back to. */
export function homeOf(options: Options) {
  return options.whole === true
    ? (options.act ?? "santai")
    : (options.act ?? "pegang");
}
