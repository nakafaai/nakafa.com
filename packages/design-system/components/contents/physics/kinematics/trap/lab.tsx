import {
  advanceRun,
  shownTime,
} from "@repo/design-system/components/contents/physics/canvas/clock";
import { useMeasure } from "@repo/design-system/components/contents/physics/canvas/measure";
import {
  fade,
  mix,
  spotlight,
  vignette,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  type Graph,
  graphX,
  graphY,
  paintCurve,
  paintGraph,
  paintGraphDot,
  paintSlopeLine,
} from "@repo/design-system/components/contents/physics/canvas/plot";
import {
  paintCar,
  paintLandscape,
  paintRoad,
  type Road,
  roadX,
} from "@repo/design-system/components/contents/physics/canvas/scene";
import {
  TRAP_ACCELERATION,
  TRAP_CENTRE,
  type TrapGap,
  TrapGapSchema,
  trapArrival,
  trapPosition,
  trapReading,
} from "@repo/design-system/components/contents/physics/kinematics/trap/gates";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** How far the track runs, in metres: past the widest trap. */
const TRACK = 80;

/** How long the run lasts: until the car reaches the end of the track. */
const DURATION = trapArrival(TRACK);

/** Simulated seconds per wall second: the run is slowed so the beams can be seen breaking. */
const PLAY_RATE = 0.6;

/** How long the finished run rests before it starts again, in wall seconds. */
const HOLD_SECONDS = 1.5;

/** What the sketch reads on every frame: the gap between the two gates. */
interface TrapFrame {
  readonly gap: TrapGap;
}

/** The road band above and the graph below, for one canvas size. */
function layout(sketch: p5) {
  const { height, width } = sketch;
  const margin = width * 0.07;
  const road: Road = {
    height: height * 0.46,
    origin: margin,
    scale: (width - 2 * margin) / TRACK,
    surface: height * 0.4,
    top: 0,
  };
  const graph: Graph = {
    box: { height: height * 0.42, width: width - 2 * margin, x: margin, y: height * 0.53 },
    time: [0, Math.ceil(DURATION)],
    value: [-4, TRACK + 4],
  };
  return { graph, road };
}

/** One gate: a post with a lens at bumper height that glows while the car blocks its beam. */
function paintGate(sketch: p5, road: Road, metres: number, broken: boolean) {
  const x = roadX(road, metres);
  const tall = road.height * 0.42;
  sketch.push();
  sketch.noStroke();
  sketch.fill(getColor("ZINC", 900));
  sketch.rect(x - 4, road.surface - tall, 8, tall);
  sketch.fill(getColor("SLATE", 600));
  sketch.rect(x - 7, road.surface - tall, 14, tall * 0.14, 3);
  const lens = { x, y: road.surface - road.height * 0.12 };
  if (broken) {
    spotlight(sketch, lens, road.height * 0.22, { color: PLOT_COLORS.amber, strength: 0.85 });
  }
  sketch.fill(broken ? PLOT_COLORS.amber : mix(PLOT_COLORS.amber, getColor("ZINC", 900), 0.6));
  sketch.circle(lens.x, lens.y, 9);
  sketch.pop();
}

/**
 * Draws one moment of the run: the car speeds up through the trap, each
 * gate glowing while the car crosses its beam, and the position-time graph
 * below with the secant across the gap and the tangent at the centre.
 */
function trapProgram(sketch: p5, read: () => TrapFrame) {
  let time = DURATION;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
  };
  sketch.draw = () => {
    const { gap } = read();
    if (sketch.isLooping()) {
      time = advanceRun(time, sketch.deltaTime / 1000, { duration: DURATION, hold: HOLD_SECONDS, rate: PLAY_RATE });
    }
    const now = shownTime(time, DURATION);
    const { graph, road } = layout(sketch);
    const reading = trapReading(gap);
    const position = trapPosition(now);
    sketch.background(getColor("ZINC", 950));
    paintLandscape(sketch, road);
    paintRoad(sketch, road, { length: TRACK, step: 10 });
    sketch.push();
    sketch.noStroke();
    sketch.fill(fade(PLOT_COLORS.amber, 0.14));
    sketch.rect(roadX(road, TRAP_CENTRE - gap / 2), road.surface - road.height * 0.05, (gap * road.scale), road.height * 0.25);
    sketch.pop();
    const carLength = Math.min(road.height * 0.5, sketch.width * 0.13);
    const front = roadX(road, position);
    paintGate(sketch, road, TRAP_CENTRE - gap / 2, now >= reading.enter && front - carLength <= roadX(road, TRAP_CENTRE - gap / 2));
    paintGate(sketch, road, TRAP_CENTRE + gap / 2, now >= reading.leave && front - carLength <= roadX(road, TRAP_CENTRE + gap / 2));
    paintCar(sketch, road, { color: PLOT_COLORS.pink, length: carLength, rear: front - carLength });

    paintGraph(sketch, graph, { time: 1, value: 10 });
    paintCurve(sketch, graph, trapPosition, { color: fade(getColor("SLATE", 300), 0.35), until: DURATION, weight: 2 });
    paintCurve(sketch, graph, trapPosition, { color: PLOT_COLORS.pink, until: now, weight: 3 });
    const centre = { time: trapArrival(TRAP_CENTRE), value: TRAP_CENTRE };
    paintSlopeLine(sketch, graph, centre, reading.instant, { color: fade(getColor("ZINC", 100), 0.65), weight: 1.5 });
    const enter = { time: reading.enter, value: TRAP_CENTRE - gap / 2 };
    const leave = { time: reading.leave, value: TRAP_CENTRE + gap / 2 };
    sketch.push();
    sketch.stroke(PLOT_COLORS.amber);
    sketch.strokeWeight(3);
    sketch.line(graphX(graph, enter.time), graphY(graph, enter.value), graphX(graph, leave.time), graphY(graph, leave.value));
    sketch.pop();
    paintGraphDot(sketch, graph, enter, PLOT_COLORS.amber);
    paintGraphDot(sketch, graph, leave, PLOT_COLORS.amber);
    paintGraphDot(sketch, graph, { time: now, value: position }, PLOT_COLORS.pink);
    vignette(sketch, 0.3);
  };
}

interface SpeedTrapLabProps {
  description: ReactNode;
  labels: {
    averageSpeed: ReactNode;
    chooseGap: string;
    elapsed: ReactNode;
    gap: ReactNode;
    instantSpeed: ReactNode;
    viewLabel: string;
  };
  title: ReactNode;
}

/**
 * A speed trap of two light gates around one spot of a test track, which a
 * car crosses while speeding up from rest at 4 m/s². The trap reads the
 * average speed across its gap; shrinking the gap brings that reading to
 * the car's instantaneous speed at the centre, 20 m/s, and on the graph the
 * secant turns into the tangent.
 */
export function SpeedTrapLab({ description, labels, title }: SpeedTrapLabProps) {
  const [gap, setGap] = useState<TrapGap>(40);
  const measure = useMeasure();
  const reading = trapReading(gap);
  const isGap = Schema.is(TrapGapSchema);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseGap}
          gridColumns="4"
          onValueChange={(value) => {
            const next = Number(value);
            if (isGap(next)) {
              setGap(next);
            }
          }}
          type="single"
          value={String(gap)}
          variant="outline"
        >
          {Arr.map(TrapGapSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={String(option)}>
              <InlineMath math={`d=${option}\\text{ m}`} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch label={labels.viewLabel} program={trapProgram} state={{ gap }} />
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular label={labels.gap} value={<InlineMath math={measure(gap, "\\text{ m}", 0)} />} />
          <VisualFactTabular label={labels.elapsed} value={<InlineMath math={measure(reading.elapsed, "\\text{ s}", 3)} />} />
          <VisualFactTabular label={labels.averageSpeed} value={<InlineMath math={measure(reading.average, "\\text{ m/s}", 2)} />} />
          <VisualFactTabular label={labels.instantSpeed} value={<InlineMath math={measure(TRAP_ACCELERATION * trapArrival(TRAP_CENTRE), "\\text{ m/s}", 2)} />} />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
