import { RoundedBox } from "@react-three/drei";
import { useTravel } from "@repo/design-system/components/contents/physics/kinematics/travel";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group, Material } from "three";
import {
  ExtrudeGeometry,
  LatheGeometry,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Shape,
  Vector2,
} from "three";
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * A two-axle electric railcar at real size, in metres, facing +x with its
 * origin on the rail head under its middle: 7.64 m long, 2.5 m wide, 3.3 m
 * tall to the roof, on standard gauge with wheels of 0.42 m radius.
 */
export const RAILCAR = {
  axle: 2.2,
  gauge: 1.435,
  half: 1.25,
  length: 7.64,
  roof: 3.3,
  wheelRadius: 0.42,
} as const;

/** The two ends of the car, and its two sides. */
const ENDS = [1, -1] as const;

/** How far the windscreen leans back from upright, in radians. */
const RAKE = Math.atan(0.5 / 1.5);

/** A value's place between two edges, eased so it leaves and arrives level. */
function ease(from: number, to: number, value: number) {
  const place = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return place * place * (3 - 2 * place);
}

/**
 * The car body seen from the side: a skirt just above the rails, an upright
 * nose under a windscreen raked back to a flat roof, the same at both ends.
 */
function bodyShape() {
  const shape = new Shape();
  shape.moveTo(-3.55, 0.5);
  shape.lineTo(3.55, 0.5);
  shape.quadraticCurveTo(3.8, 0.52, 3.82, 0.85);
  shape.lineTo(3.8, 1.55);
  shape.lineTo(3.3, 3.05);
  shape.quadraticCurveTo(3.2, RAILCAR.roof, 2.9, RAILCAR.roof);
  shape.lineTo(-2.9, RAILCAR.roof);
  shape.quadraticCurveTo(-3.2, RAILCAR.roof, -3.3, 3.05);
  shape.lineTo(-3.8, 1.55);
  shape.lineTo(-3.82, 0.85);
  shape.quadraticCurveTo(-3.8, 0.52, -3.55, 0.5);
  return shape;
}

/**
 * The pressed body: the side outline drawn across the car with rounded
 * edges, cut into small panels and narrowed toward both cabs so the corners
 * round off in plan as a tram's do.
 */
function bodyGeometry() {
  const bevel = 0.14;
  const depth = 2 * RAILCAR.half - 2 * bevel;
  const extruded = new ExtrudeGeometry(bodyShape(), {
    bevelEnabled: true,
    bevelOffset: -bevel,
    bevelSegments: 5,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 16,
    depth,
  });
  extruded.translate(0, 0, -depth / 2);
  const geometry = new TessellateModifier(0.22, 6).modify(extruded);
  extruded.dispose();
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index += 1) {
    const plan =
      1 - 0.18 * ease(2.6, 3.82, Math.abs(position.getX(index))) ** 2;
    position.setZ(index, position.getZ(index) * plan);
  }
  return toCreasedNormals(geometry, Math.PI / 5);
}

/** A steel wheel turned about the axle, z: a coned tread with its flange inboard. */
function wheelGeometry() {
  const geometry = new LatheGeometry(
    Arr.map(
      [
        [0.1, -0.07],
        [0.3, -0.06],
        [0.36, -0.07],
        [RAILCAR.wheelRadius + 0.04, -0.075],
        [RAILCAR.wheelRadius + 0.04, -0.045],
        [RAILCAR.wheelRadius, -0.03],
        [RAILCAR.wheelRadius - 0.006, 0.065],
        [0.36, 0.07],
        [0.3, 0.05],
        [0.1, 0.06],
      ] as const,
      ([radius, side]) => new Vector2(radius, side)
    ),
    48
  );
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

/** Dark tinted glazing, as in the side windows and the windscreens. */
function Glazing() {
  return (
    <meshPhysicalMaterial
      clearcoat={1}
      clearcoatRoughness={0.03}
      color={CAR_COLORS.tintedGlass}
      envMapIntensity={1.5}
      metalness={0.55}
      roughness={0.05}
    />
  );
}

/** Unpainted dark steel and plastic under the floor and on the roof. */
function Underframe() {
  return (
    <SurfaceMaterial
      color={CAR_COLORS.grille}
      repeat={[4, 1]}
      roughness={0.7}
      surface="paint"
    />
  );
}

/**
 * What one side of the car carries: the window band, the pillars between its
 * panes, the double door's shut lines and the livery stripe.
 */
function Flank({
  livery,
  side,
}: {
  readonly livery: Material;
  readonly side: 1 | -1;
}) {
  const flank = side * RAILCAR.half;
  return (
    <group>
      <mesh position={[0, 2.17, flank + side * 0.004]}>
        <boxGeometry args={[5.1, 0.92, 0.012]} />
        <Glazing />
      </mesh>
      {Arr.map([-1.62, -0.56, 0.56, 1.62], (x) => (
        <mesh key={x} position={[x, 2.17, flank + side * 0.01]}>
          <boxGeometry args={[0.09, 0.94, 0.014]} />
          <meshStandardMaterial
            color={MACHINE_COLORS.turbineWhite}
            roughness={0.4}
          />
        </mesh>
      ))}
      {Arr.map([-0.56, 0, 0.56], (x) => (
        <mesh key={x} position={[x, 1.15, flank + side * 0.002]}>
          <boxGeometry args={[0.014, 1.1, 0.006]} />
          <meshStandardMaterial color={CAR_COLORS.grille} roughness={0.6} />
        </mesh>
      ))}
      <mesh material={livery} position={[0, 1.14, flank + side * 0.003]}>
        <boxGeometry args={[5.1, 0.3, 0.008]} />
      </mesh>
    </group>
  );
}

/** One cab end: its raked windscreen, the stripe across the nose, lamps and coupler. */
function Cab({
  end,
  livery,
}: {
  readonly end: 1 | -1;
  readonly livery: Material;
}) {
  return (
    <group>
      <mesh
        position={[end * (3.55 + Math.cos(RAKE) * 0.015), 2.32, 0]}
        rotation={[0, 0, end * RAKE]}
      >
        <boxGeometry args={[0.03, 1.2, 1.74]} />
        <Glazing />
      </mesh>
      <mesh material={livery} position={[end * 3.815, 1.14, 0]}>
        <boxGeometry args={[0.012, 0.3, 1.72]} />
      </mesh>
      {Arr.map(ENDS, (side) => (
        <RoundedBox
          args={[0.05, 0.13, 0.3]}
          key={side}
          position={[end * 3.815, 0.8, side * 0.62]}
          radius={0.02}
          smoothness={2}
        >
          <meshStandardMaterial
            color={
              end > 0 ? CAR_COLORS.headlightLens : CAR_COLORS.brakeLightLens
            }
            emissive={
              end > 0 ? CAR_COLORS.headlightGlow : CAR_COLORS.brakeLightGlow
            }
            emissiveIntensity={end > 0 ? 1.4 : 0.9}
            roughness={0.1}
          />
        </RoundedBox>
      ))}
      <mesh position={[end * 3.86, 0.56, 0]}>
        <boxGeometry args={[0.3, 0.14, 0.22]} />
        <Underframe />
      </mesh>
    </group>
  );
}

/** The roof's equipment: the air-conditioning unit and the pantograph raised to the wire. */
function RoofGear() {
  return (
    <group>
      <RoundedBox
        args={[1.9, 0.26, 1.5]}
        castShadow
        position={[-1.2, RAILCAR.roof + 0.12, 0]}
        radius={0.06}
        smoothness={3}
      >
        <SurfaceMaterial
          color={CAR_COLORS.rimBright}
          repeat={[3, 2]}
          roughness={0.55}
          surface="paint"
        />
      </RoundedBox>
      <group position={[1.3, RAILCAR.roof, 0]}>
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[1.1, 0.07, 0.9]} />
          <Underframe />
        </mesh>
        {Arr.map(
          [
            [-0.22, 0.34, 0.9],
            [-0.22, 0.86, -0.9],
          ] as const,
          ([x, y, turn]) => (
            <mesh key={y} position={[x, y, 0]} rotation={[0, 0, turn]}>
              <cylinderGeometry args={[0.022, 0.022, 0.84, 10]} />
              <Underframe />
            </mesh>
          )
        )}
        <mesh position={[0.1, 1.13, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 1.5, 10]} />
          <meshStandardMaterial
            color={CAR_COLORS.castIron}
            metalness={1}
            roughness={0.4}
          />
        </mesh>
      </group>
    </group>
  );
}

/**
 * A two-axle electric railcar: a white pressed body with tinted windows, a
 * double door and a livery stripe each side, a raked windscreen and lamps at
 * each cab, steel wheels on the rails, and a pantograph on the roof. Its
 * wheels turn by the distance it really moves along the line.
 *
 * @param color - The livery stripe, which a lab ties to its legend
 */
export function Railcar({ color }: { readonly color: string }) {
  const car = useRef<Group>(null);
  const wheels = useRef<Group[]>([]);
  const body = useMemo(bodyGeometry, []);
  const wheel = useMemo(wheelGeometry, []);
  const paint = useMemo(
    () =>
      new MeshPhysicalMaterial({
        clearcoat: 0.8,
        clearcoatRoughness: 0.12,
        color: MACHINE_COLORS.turbineWhite,
        metalness: 0.1,
        roughness: 0.36,
      }),
    []
  );
  // The stripe's paint, shared by both flanks and both cab ends.
  const livery = useMemo(
    () => new MeshStandardMaterial({ color, roughness: 0.38 }),
    [color]
  );
  useEffect(
    () => () => {
      body.dispose();
      wheel.dispose();
      paint.dispose();
    },
    [body, paint, wheel]
  );
  useEffect(() => () => livery.dispose(), [livery]);
  useTravel(car, (distance) => {
    Arr.forEach(wheels.current, (each) => {
      each.rotation.z = -distance / RAILCAR.wheelRadius;
    });
  });

  return (
    <group ref={car}>
      <mesh castShadow geometry={body} material={paint} receiveShadow />
      <mesh castShadow position={[0, 0.36, 0]}>
        <boxGeometry args={[6.4, 0.3, 1.9]} />
        <Underframe />
      </mesh>
      {Arr.map(ENDS, (end) => (
        <group key={end}>
          <Flank livery={livery} side={end} />
          <Cab end={end} livery={livery} />
          <group
            position={[end * RAILCAR.axle, RAILCAR.wheelRadius, 0]}
            ref={(axle) => {
              if (axle) {
                wheels.current[end > 0 ? 0 : 1] = axle;
              }
            }}
          >
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.08, 0.08, RAILCAR.gauge + 0.3, 16]} />
              <meshStandardMaterial
                color={CAR_COLORS.hub}
                metalness={1}
                roughness={0.5}
              />
            </mesh>
            {Arr.map(ENDS, (side) => (
              <mesh
                castShadow
                geometry={wheel}
                key={side}
                position={[0, 0, (side * RAILCAR.gauge) / 2]}
                rotation={[0, side > 0 ? 0 : Math.PI, 0]}
              >
                <SurfaceMaterial
                  color={CAR_COLORS.castIron}
                  metalness={1}
                  repeat={[6, 1]}
                  roughness={0.42}
                  surface="brushed"
                />
              </mesh>
            ))}
          </group>
          {Arr.map(ENDS, (side) => (
            <RoundedBox
              args={[0.7, 0.26, 0.14]}
              key={side}
              position={[
                end * RAILCAR.axle,
                RAILCAR.wheelRadius + 0.02,
                side * (RAILCAR.gauge / 2 + 0.2),
              ]}
              radius={0.04}
              smoothness={2}
            >
              <Underframe />
            </RoundedBox>
          ))}
        </group>
      ))}
      <RoofGear />
    </group>
  );
}
