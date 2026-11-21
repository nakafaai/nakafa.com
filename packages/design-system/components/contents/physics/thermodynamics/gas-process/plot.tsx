import { Line, useCursor } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BOARD,
  INK,
  LABEL_SIZE,
  PAPER_LABEL,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/board";
import type { Axes } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/diagram";
import {
  arrowOn,
  bandIndex,
  bandPositions,
  pathStates,
  plotPoint,
  SAMPLES,
  tagSides,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/diagram";
import type {
  GasProcess,
  GasState,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import { Isotherms } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/isotherms";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisual } from "@repo/design-system/components/visual/card";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option, Predicate } from "effect";
import type { RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from "three";

/** The plot on the board, in metres. */
const PLOT = BOARD.plot;

/** The way the plot faces, before its board is turned. */
const FACING = new Vector3(0, 0, 1);

/** Lets the default camera controls turn the view, or holds them while the learner drags on the plot. */
function holdControls(controls: unknown, held: boolean) {
  if (Predicate.hasProperty(controls, "enabled")) {
    controls.enabled = !held;
  }
}

/**
 * Lets the learner press and drag on the plot: each place the pointer passes
 * over the plot, in metres from its origin, goes to `onSpot`. The camera
 * holds still while the learner drags, and a play stops, so the hand moves
 * the gas.
 */
function usePlotDrag(
  origin: RefObject<Group | null>,
  onSpot: (spot: { readonly x: number; readonly y: number }) => void
) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  const { playing, togglePlaying } = useVisual((state) => ({
    playing: state.playing,
    togglePlaying: state.togglePlaying,
  }));
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) {
      return;
    }
    const element = gl.domElement;
    const caster = new Raycaster();
    const pointer = new Vector2();
    const plane = new Plane();
    const hit = new Vector3();
    const move = (event: PointerEvent) => {
      const group = origin.current;
      if (group === null) {
        return;
      }
      const box = element.getBoundingClientRect();
      pointer.set(
        ((event.clientX - box.left) / box.width) * 2 - 1,
        1 - ((event.clientY - box.top) / box.height) * 2
      );
      caster.setFromCamera(pointer, camera);
      plane.setFromNormalAndCoplanarPoint(
        FACING.clone().transformDirection(group.matrixWorld),
        group.getWorldPosition(new Vector3())
      );
      if (caster.ray.intersectPlane(plane, hit) !== null) {
        const local = group.worldToLocal(hit);
        onSpot({ x: local.x, y: local.y });
      }
    };
    const end = () => setDragging(false);
    const page = element.ownerDocument;
    page.addEventListener("pointermove", move);
    page.addEventListener("pointerup", end);
    page.addEventListener("pointercancel", end);
    return () => {
      page.removeEventListener("pointermove", move);
      page.removeEventListener("pointerup", end);
      page.removeEventListener("pointercancel", end);
      holdControls(controls, false);
    };
  }, [camera, controls, dragging, gl, onSpot, origin]);

  return (event: ThreeEvent<PointerEvent>) => {
    const group = origin.current;
    if (group === null) {
      return;
    }
    event.stopPropagation();
    holdControls(controls, true);
    if (playing) {
      togglePlaying();
    }
    const local = group.worldToLocal(event.point.clone());
    onSpot({ x: local.x, y: local.y });
    setDragging(true);
  };
}

/**
 * The marks of one process on the p-V diagram: the isotherms through its
 * start and its end, dashed; its path from state 1 to state 2 with an arrow
 * the way it runs; the band under the path, whose area is the work W, which
 * grows behind the gas while a play moves it; a dot for the gas now; and the
 * ring at state 2 that the learner drags along the path. A press anywhere on
 * the plot moves the end there along the process's own curve.
 */
export function PlotMarks({
  axes,
  end,
  gamma,
  now,
  onSpot,
  process,
  start,
}: {
  readonly axes: Axes;
  readonly end: GasState;
  readonly gamma: number;
  readonly now: RefObject<{ readonly share: number }>;
  readonly onSpot: (spot: { readonly x: number; readonly y: number }) => void;
  readonly process: GasProcess;
  readonly start: GasState;
}) {
  const origin = useRef<Group>(null);
  const dot = useRef<Group>(null);
  const drawn = useRef<{ readonly path: unknown; readonly share: number }>({
    path: null,
    share: -1,
  });
  const [hovered, setHovered] = useState(false);
  useCursor(hovered, "grab", "auto");
  const press = usePlotDrag(origin, onSpot);
  const path = useMemo(
    () =>
      Arr.map(pathStates(process, { end, start }, gamma, SAMPLES, 1), (state) =>
        plotPoint(state, axes, PLOT)
      ),
    [axes, end, gamma, process, start]
  );
  const band = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array((SAMPLES + 1) * 6), 3)
    );
    geometry.setIndex(bandIndex(SAMPLES));
    return geometry;
  }, []);
  useEffect(() => () => band.dispose(), [band]);

  useFrame(() => {
    const share = now.current.share;
    if (share === drawn.current.share && path === drawn.current.path) {
      return;
    }
    drawn.current = { path, share };
    const states = pathStates(process, { end, start }, gamma, SAMPLES, share);
    band.setAttribute(
      "position",
      new BufferAttribute(bandPositions(states, axes, PLOT), 3)
    );
    band.computeBoundingSphere();
    const spot = plotPoint(Arr.lastNonEmpty(states), axes, PLOT);
    dot.current?.position.set(spot.x, spot.y, INK * 3);
  });

  const first = plotPoint(start, axes, PLOT);
  const last = plotPoint(end, axes, PLOT);
  const worked = Math.abs(last.x - first.x) > 1e-6;
  const sides = tagSides(first, last);
  const middle = Arr.getUnsafe(path, SAMPLES / 2);

  return (
    <group ref={origin}>
      <Isotherms axes={axes} end={end} process={process} start={start} />
      <mesh geometry={band} position={[0, 0, INK / 2]}>
        <meshBasicMaterial
          color={PLOT_COLORS.teal}
          depthWrite={false}
          opacity={0.5}
          side={DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
      {worked ? (
        <ThreeLabel
          {...PAPER_LABEL}
          color={PLOT_COLORS.teal}
          fontSize={LABEL_SIZE * 1.25}
          position={[middle.x, Math.max(middle.y / 2, 0.014), INK]}
        >
          <InlineMath math="W" />
        </ThreeLabel>
      ) : null}
      <Line
        color={INSTRUMENT_COLORS.graphite}
        lineWidth={3}
        points={Arr.map(path, (spot) => new Vector3(spot.x, spot.y, INK * 2))}
      />
      {Option.match(arrowOn(path), {
        onNone: () => null,
        onSome: (arrow) => (
          <mesh
            position={[arrow.x, arrow.y, INK * 2]}
            rotation={[0, 0, arrow.angle - Math.PI / 2]}
          >
            <coneGeometry args={[0.0075, 0.02, 18]} />
            <meshBasicMaterial color={INSTRUMENT_COLORS.graphite} />
          </mesh>
        ),
      })}
      <mesh position={[first.x, first.y, INK * 3]}>
        <circleGeometry args={[0.0065, 24]} />
        <meshBasicMaterial color={INSTRUMENT_COLORS.graphite} />
      </mesh>
      <mesh position={[last.x, last.y, INK * 3]}>
        <ringGeometry args={[0.0095, 0.0135, 32]} />
        <meshBasicMaterial color={INSTRUMENT_COLORS.graphite} />
      </mesh>
      <group ref={dot}>
        <mesh>
          <circleGeometry args={[0.0065, 24]} />
          <meshBasicMaterial color={INSTRUMENT_COLORS.graphite} />
        </mesh>
      </group>
      {Arr.map(
        [
          { at: first, name: "1", side: sides.start },
          { at: last, name: "2", side: sides.end },
        ],
        ({ at, name, side }) => (
          <ThreeLabel
            {...PAPER_LABEL}
            anchorX={side > 0 ? "left" : "right"}
            anchorY={side > 0 ? "bottom" : "top"}
            fontSize={LABEL_SIZE}
            key={name}
            position={[at.x + side * 0.009, at.y + side * 0.009, INK]}
          >
            {name}
          </ThreeLabel>
        )
      )}
      <mesh
        onPointerDown={press}
        onPointerOut={() => setHovered(false)}
        onPointerOver={() => setHovered(true)}
        position={[PLOT.width / 2, PLOT.height / 2, INK * 4]}
      >
        <planeGeometry args={[PLOT.width + 0.04, PLOT.height + 0.04]} />
        <meshBasicMaterial depthWrite={false} opacity={0} transparent />
      </mesh>
    </group>
  );
}
