import {
  Mirror,
  SedanTrim,
} from "@repo/design-system/components/contents/physics/kinematics/fascia";
import {
  BrakeCaliper,
  WHEEL,
  WheelRotor,
} from "@repo/design-system/components/contents/physics/kinematics/tyre";
import { getColor } from "@repo/design-system/lib/color";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { Array as Arr } from "effect";
import type { Ref } from "react";
import { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { BufferGeometry, Group } from "three";
import {
  DataTexture,
  ExtrudeGeometry,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Path,
  Shape,
  Vector2,
} from "three";
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * A four-door sedan at real size, in metres, facing +x with its origin on the
 * road between the axles: 4.67 m long, 1.8 m wide, 1.43 m tall, wheels of
 * 0.34 m radius on a 2.7 m wheelbase, as a mid-size car measures.
 */
export const SEDAN = {
  frontAxle: 1.38,
  height: 1.43,
  length: 4.67,
  rearAxle: -1.32,
  track: 1.56,
  wheelRadius: WHEEL.radius,
  width: 1.8,
} as const;

/** What a simulation drives on the car every frame. */
export interface SedanRig {
  /** Places the car `distance` metres down the road, braking or not. */
  readonly place: (distance: number, braking: boolean) => void;
  /** Turns the wheels as if the car had rolled `distance` metres, wherever a lab puts it. */
  readonly roll: (distance: number) => void;
}

/** How brightly the tail lights burn while the driver brakes, and otherwise. */
const BRAKE_GLOW = 7;
const TAIL_GLOW = 0.3;

/** How far an extrusion's rounded edge adds to its depth on each side. */
const BODY_BEVEL = 0.035;
const CABIN_BEVEL = 0.05;
const EDGE = 1.3;

/** The body between its rounded edges, and the glasshouse, which is narrower. */
const BODY_DEPTH = SEDAN.width - 2 * BODY_BEVEL * EDGE;
const CABIN_DEPTH = 1.47;

/** How much the glasshouse leans in from the waistline to the roof. */
const TUMBLEHOME = 0.16;

/** Panels meeting at less than this angle shade as one curved surface. */
const CREASE = Math.PI / 5;
const WAIST = 0.97;

/** The height of the sills above the road. */
const SILL = 0.24;

/** The windscreen and the rear window as quadratic curves: start, control, end. */
const WINDSCREEN = [
  [1.2, WAIST],
  [0.64, 1.38],
  [0.3, 1.42],
] as const;
const REAR_WINDOW = [
  [-0.72, 1.41],
  [-1.12, 1.36],
  [-1.5, WAIST],
] as const;

/** A quadratic curve: where it starts, its control point, and where it ends. */
type Curve = readonly [
  readonly [number, number],
  readonly [number, number],
  readonly [number, number],
];

/** A point of a quadratic curve at `time` between 0 and 1. */
function curveAt(
  [[startX, startY], [controlX, controlY], [endX, endY]]: Curve,
  time: number
) {
  const rest = 1 - time;
  return new Vector2(
    rest * rest * startX + 2 * rest * time * controlX + time * time * endX,
    rest * rest * startY + 2 * rest * time * controlY + time * time * endY
  );
}

/**
 * The lower body seen from the car's left: rear bumper, boot lid, the
 * waistline the windows sit on, the bonnet falling to the nose and the front
 * bumper, with arches cut for the wheels.
 */
function createBodyShape() {
  const arch = SEDAN.wheelRadius + 0.04;
  // The arches meet the sill where their circle crosses it, without a step.
  const foot = Math.asin((SEDAN.wheelRadius - SILL) / arch);
  const shape = new Shape();
  shape.moveTo(-2.22, SILL);
  Arr.forEach([SEDAN.rearAxle, SEDAN.frontAxle], (axle) => {
    shape.absarc(axle, SEDAN.wheelRadius, arch, Math.PI + foot, -foot, true);
  });
  shape.lineTo(2.18, SILL);
  shape.quadraticCurveTo(2.33, 0.26, 2.33, 0.5);
  shape.quadraticCurveTo(2.33, 0.71, 2.18, 0.75);
  shape.quadraticCurveTo(1.7, 0.9, 1.1, 0.985);
  shape.lineTo(-1.52, 1.03);
  shape.quadraticCurveTo(-1.9, 1.045, -2.16, 1.0);
  shape.quadraticCurveTo(-2.33, 0.97, -2.34, 0.7);
  shape.quadraticCurveTo(-2.35, 0.3, -2.22, SILL);
  return shape;
}

/** The glasshouse seen from the side: windscreen, roof line and rear window. */
function createCabinShape() {
  const shape = new Shape();
  shape.moveTo(-1.5, WAIST);
  shape.lineTo(1.2, WAIST);
  shape.quadraticCurveTo(0.64, 1.38, 0.3, 1.42);
  shape.lineTo(-0.72, 1.41);
  shape.quadraticCurveTo(-1.12, 1.36, -1.5, WAIST);
  return shape;
}

/**
 * The painted frame of one side of the glasshouse: the cabin's outline with
 * the front and rear door windows cut out, which leaves the pillars, the roof
 * rail and the waist rail standing over the glass.
 */
function createFrameShape() {
  const shape = createCabinShape();
  shape.holes = [
    new Path([
      new Vector2(0.98, 1.035),
      new Vector2(0.6, 1.265),
      new Vector2(0.33, 1.342),
      new Vector2(-0.17, 1.348),
      new Vector2(-0.17, 1.035),
    ]),
    new Path([
      new Vector2(-0.29, 1.035),
      new Vector2(-0.29, 1.348),
      new Vector2(-0.7, 1.342),
      new Vector2(-1.0, 1.265),
      new Vector2(-1.22, 1.11),
      new Vector2(-1.27, 1.035),
    ]),
  ];
  return shape;
}

/**
 * The roof panel seen from the side: a thin skin over the glass from the top
 * of the windscreen to the top of the rear window.
 */
function createRoofShape() {
  const line = [
    ...Arr.makeBy(5, (step) => curveAt(WINDSCREEN, 0.74 + (step * 0.26) / 4)),
    ...Arr.makeBy(5, (step) => curveAt(REAR_WINDOW, (step * 0.3) / 4)),
  ];
  return new Shape([
    ...Arr.map(line, (point) => new Vector2(point.x, point.y + 0.008)),
    ...Arr.map(
      Arr.reverse(line),
      (point) => new Vector2(point.x, point.y - 0.03)
    ),
  ]);
}

/**
 * Extrudes a side outline across the car, from `from` toward +z. The rounded
 * edge is cut into the outline, so a panel keeps the size its outline draws.
 */
function extrudeAcross(
  shape: Shape,
  depth: number,
  bevel: number,
  from: number
) {
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelOffset: -bevel,
    bevelSegments: 5,
    bevelSize: bevel,
    bevelThickness: bevel * EDGE,
    curveSegments: 28,
    depth,
  });
  geometry.translate(0, 0, from);
  return geometry;
}

/** A value's place between two edges, eased so it leaves and arrives level. */
function ease(from: number, to: number, value: number) {
  const place = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return place * place * (3 - 2 * place);
}

/**
 * Sculpts the extruded body as sheet metal is pressed: the nose and tail
 * narrow in plan so the corners round off, the shoulders roll in above the
 * door handles, and the sills tuck under toward the road.
 */
function sculptBody(extruded: BufferGeometry) {
  // The flat flanks are cut into small panels first, so they bend smoothly.
  const geometry = new TessellateModifier(0.12, 6).modify(extruded);
  extruded.dispose();
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const plan = 1 - 0.2 * ease(1.25, 2.34, Math.abs(x)) ** 2;
    const shoulder = 1 - 0.06 * ease(0.9, 1.04, y);
    const sill = 1 - 0.05 * ease(0.42, 0.24, y);
    position.setZ(index, position.getZ(index) * plan * shoulder * sill);
  }
  return toCreasedNormals(geometry, CREASE);
}

/**
 * Pulls a part of the glasshouse in toward the roof (tumblehome), so the
 * cabin leans inward over the doors as a car's does.
 */
function lean(geometry: BufferGeometry) {
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index += 1) {
    const rise = Math.min(
      1,
      Math.max(0, (position.getY(index) - WAIST) / 0.45)
    );
    position.setZ(index, position.getZ(index) * (1 - TUMBLEHOME * rise));
  }
  return toCreasedNormals(geometry, CREASE);
}

/** Every pressed panel of the car: the body, the glass, the side frames and the roof. */
function createPanels() {
  const glassHalf = CABIN_DEPTH / 2 + CABIN_BEVEL * EDGE;
  const frame = createFrameShape();
  return {
    body: sculptBody(
      extrudeAcross(createBodyShape(), BODY_DEPTH, BODY_BEVEL, -BODY_DEPTH / 2)
    ),
    cabin: lean(
      extrudeAcross(
        createCabinShape(),
        CABIN_DEPTH,
        CABIN_BEVEL,
        -CABIN_DEPTH / 2
      )
    ),
    frames: Arr.map([glassHalf - 0.006, -glassHalf - 0.008], (from) =>
      lean(extrudeAcross(frame, 0.014, 0.004, from))
    ),
    roof: lean(
      extrudeAcross(
        createRoofShape(),
        CABIN_DEPTH + 0.1,
        0.012,
        -CABIN_DEPTH / 2 - 0.05
      )
    ),
  };
}

/**
 * A sedan with clear-coated metallic paint, a tinted glasshouse framed by
 * painted pillars, rubber tyres on alloy rims over drilled brake discs, and
 * tail lights that flare while it brakes. A simulation moves it through
 * `ref`, so it never re-renders mid-stop.
 */
export function Sedan({
  color,
  ref,
}: {
  readonly color: string;
  readonly ref?: Ref<SedanRig>;
}) {
  const car = useRef<Group>(null);
  const wheels = useRef<Group[]>([]);
  // Deep, clear-coated automotive paint over a lightly metallic base.
  const paint = useMemo(
    () =>
      new MeshPhysicalMaterial({
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        color,
        metalness: 0.3,
        roughness: 0.3,
      }),
    [color]
  );
  const tail = useMemo(
    () =>
      new MeshStandardMaterial({
        color: CAR_COLORS.brakeLightLens,
        emissive: CAR_COLORS.brakeLightGlow,
        emissiveIntensity: TAIL_GLOW,
        roughness: 0.18,
      }),
    []
  );
  const panels = useMemo(createPanels, []);

  useEffect(
    () => () => {
      panels.body.dispose();
      panels.cabin.dispose();
      panels.roof.dispose();
      Arr.forEach(panels.frames, (frame) => frame.dispose());
    },
    [panels]
  );
  useEffect(
    () => () => {
      tail.dispose();
      paint.dispose();
    },
    [paint, tail]
  );

  useImperativeHandle(ref, () => {
    const roll = (distance: number) => {
      const turn = -distance / SEDAN.wheelRadius;
      Arr.forEach(wheels.current, (wheel) => {
        wheel.rotation.z = turn;
      });
    };
    return {
      place: (distance, braking) => {
        car.current?.position.setX(distance);
        roll(distance);
        tail.emissiveIntensity = braking ? BRAKE_GLOW : TAIL_GLOW;
      },
      roll,
    };
  });

  return (
    <group ref={car}>
      <mesh castShadow geometry={panels.body} material={paint} receiveShadow />
      <mesh castShadow geometry={panels.cabin}>
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.02}
          color={CAR_COLORS.tintedGlass}
          envMapIntensity={1.6}
          metalness={0.55}
          roughness={0.04}
        />
      </mesh>
      {Arr.map(panels.frames, (frame) => (
        <mesh geometry={frame} key={frame.uuid} material={paint} />
      ))}
      <mesh castShadow geometry={panels.roof} material={paint} />
      <GroundShadow />
      <SedanTrim tail={tail} />
      {Arr.map([1, -1] as const, (side) => (
        <Mirror key={side} paint={paint} side={side} />
      ))}

      {Arr.map(
        [
          [SEDAN.frontAxle, 1],
          [SEDAN.frontAxle, -1],
          [SEDAN.rearAxle, 1],
          [SEDAN.rearAxle, -1],
        ] as const,
        ([x, side], index) => (
          <group
            key={`${x}-${side}`}
            position={[x, SEDAN.wheelRadius, (side * SEDAN.track) / 2]}
          >
            <group rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
              <BrakeCaliper />
            </group>
            <group
              ref={(wheel) => {
                if (wheel) {
                  wheels.current[index] = wheel;
                }
              }}
            >
              <group rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
                <WheelRotor />
              </group>
            </group>
          </group>
        )
      )}
    </group>
  );
}

/**
 * The soft dark patch under a car where the sky's light cannot reach: the
 * ambient occlusion that keeps it standing on the road wherever the sun's
 * shadow map ends. One quad with a radial falloff, drawn once.
 */
function GroundShadow() {
  const texture = useMemo(createShadowTexture, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[SEDAN.length + 1.8, SEDAN.width + 1.6]} />
      <meshBasicMaterial
        alphaMap={texture}
        color={getColor("BLACK")}
        depthWrite={false}
        opacity={0.85}
        transparent
      />
    </mesh>
  );
}

/** The falloff of the ground shadow: dark under the body, fading at its edge. */
function createShadowTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const x = (column + 0.5) / size - 0.5;
      const y = (row + 0.5) / size - 0.5;
      const edge = Math.hypot(x * 2, y * 2) / Math.SQRT2;
      const value = Math.round(255 * Math.max(0, 1 - edge ** 1.6) ** 2.2);
      data.set([value, value, value, 255], (row * size + column) * 4);
    }
  }
  const texture = new DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
}
