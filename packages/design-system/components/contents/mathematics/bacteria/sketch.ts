import { divisionCells } from "@repo/design-system/components/contents/mathematics/bacteria/layout";
import { Array as Arr } from "effect";
import type p5 from "p5";

/**
 * What the bacteria sketch reads on every frame: the cells now and in the next
 * generation, how long one generation lasts, the color they are drawn in, and
 * how to move the lesson to the next generation once a division ends.
 */
export interface BacteriaFrame {
  readonly advance: () => void;
  readonly color: string;
  readonly current: number;
  readonly generation: number;
  readonly interval: number;
  readonly maxGenerations: number;
  readonly next: number;
}

/**
 * Draws dividing bacteria. While the card plays, each generation grows and
 * then divides over one interval, and the sketch then asks for the next one;
 * a paused card shows the generation the learner chose.
 */
export function bacteriaProgram(sketch: p5, read: () => BacteriaFrame) {
  let phase = 0;
  let shown = -1;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const frame = read();
    if (frame.generation !== shown) {
      shown = frame.generation;
      phase = 0;
    }
    if (sketch.isLooping() && frame.generation < frame.maxGenerations) {
      phase += sketch.deltaTime / frame.interval;
      if (phase >= 1) {
        phase = 1;
        frame.advance();
      }
    }
    sketch.clear();
    sketch.fill(frame.color);
    Arr.forEach(
      divisionCells(
        frame.current,
        frame.next,
        phase,
        sketch.width,
        sketch.height
      ),
      ({ radius, x, y }) => {
        sketch.circle(x, y, radius * 2);
      }
    );
  };
}
