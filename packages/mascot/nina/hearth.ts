import { PAGE, POP } from "@repo/mascot/color";
import type { Pose } from "@repo/mascot/nina/pose";
import { breathe, REST, sway } from "@repo/mascot/nina/pose";
import { tenth } from "@repo/mascot/round";
import { group, path, rect } from "@repo/mascot/shape";

/** A woven hand fan held by its stick at x, y, turned by `turn` degrees from pointing up and away from her. */
function fan(x: number, y: number, turn: number) {
  return [
    group(
      [
        path({
          d: "M0,0 L22,0",
          fill: "none",
          stroke: POP.orange,
          strokeLinecap: "round",
          strokeWidth: 7,
        }),
        rect({
          fill: POP.yellow,
          height: 46,
          rx: 9,
          stroke: POP.orange,
          strokeWidth: 3,
          width: 46,
          x: 18,
          y: -23,
        }),
        path({
          d: "M30,-20 L30,20 M41,-20 L41,20 M52,-20 L52,20 M21,-9 L61,-9 M21,0 L61,0 M21,9 L61,9",
          fill: "none",
          stroke: PAGE,
          strokeLinecap: "round",
          strokeOpacity: 0.8,
          strokeWidth: 2.2,
        }),
      ],
      {
        transform: `translate(${tenth(x)} ${tenth(y)}) rotate(${tenth(turn - 42)})`,
      }
    ),
  ];
}

/**
 * Fanning a fire that burns at her side, as a satay seller does: a woven fan
 * in one hand, waved toward it. The home's own act, where she keeps the learner's run
 * of days burning.
 */
export function fanning(t: number): Pose {
  const p = breathe(REST, t);
  const wave = Math.sin(t * 6);
  const x = 174 + wave * 5;
  const y = 150 + Math.cos(t * 6) * 4;
  return {
    ...p,
    armL: sway(p.armL, t, 0.3, 1),
    armR: [124, 146, 138, 182, x - 18, y + 32, x, y],
    held: fan(x, y, wave * 18),
    layer: ["back", "front"],
    look: [4, 2],
    mood: "happy",
    tilt: p.tilt + 2,
  };
}
