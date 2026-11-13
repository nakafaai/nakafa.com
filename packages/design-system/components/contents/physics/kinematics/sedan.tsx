import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import {
  DataTexture,
  ExtrudeGeometry,
  type Group,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Shape,
  Vector2,
} from "three";

/**
 * A four-door sedan at real size, in metres, facing +x with its origin on the
 * road between the axles: 4.6 m long, 1.8 m wide, 1.45 m tall, wheels of
 * 0.34 m radius on a 2.7 m wheelbase, as a mid-size car measures.
 */
export const SEDAN = {
  frontAxle: 1.38,
  height: 1.45,
  length: 4.6,
  rearAxle: -1.32,
  track: 1.56,
  wheelRadius: 0.34,
  width: 1.8,
} as const;

/** What a simulation drives on the car every frame. */
export interface SedanRig {
  /** Places the car `distance` metres down the road, braking or not. */
  readonly place: (distance: number, braking: boolean) => void;
}

/** How brightly the tail lights burn while the driver brakes, and otherwise. */
const BRAKE_GLOW = 7;
const TAIL_GLOW = 0.3;

/** The body's half width at the doors, without the rounded edge. */
const BODY_DEPTH = SEDAN.width - 0.24;
/** The glasshouse is narrower than the doors, as a real cabin is. */
const CABIN_DEPTH = SEDAN.width - 0.56;

/** The tyre's cross section, turned around the axle: tread, shoulders, sidewalls. */
export const TYRE_PROFILE = Arr.map(
  [
    [0.215, -0.105],
    [0.29, -0.11],
    [0.325, -0.095],
    [0.34, -0.06],
    [0.34, 0.06],
    [0.325, 0.095],
    [0.29, 0.11],
    [0.215, 0.105],
  ] as const,
  ([radius, side]) => new Vector2(radius, side)
);

/**
 * The lower body seen from the car's left: rear bumper, boot, the waistline
 * the windows sit on, bonnet and front bumper, with arches cut for the wheels.
 */
function createBodyShape() {
  const arch = SEDAN.wheelRadius + 0.06;
  const shape = new Shape();
  shape.moveTo(-2.24, 0.3);
  shape.lineTo(SEDAN.rearAxle - arch, 0.3);
  shape.absarc(SEDAN.rearAxle, SEDAN.wheelRadius, arch, Math.PI, 0, true);
  shape.lineTo(SEDAN.frontAxle - arch, 0.3);
  shape.absarc(SEDAN.frontAxle, SEDAN.wheelRadius, arch, Math.PI, 0, true);
  shape.lineTo(2.22, 0.3);
  shape.quadraticCurveTo(2.33, 0.34, 2.32, 0.58);
  shape.quadraticCurveTo(2.3, 0.82, 2.06, 0.86);
  shape.lineTo(1.18, 0.99);
  shape.lineTo(-1.5, 1.0);
  shape.lineTo(-2.14, 0.96);
  shape.quadraticCurveTo(-2.32, 0.92, -2.33, 0.62);
  shape.quadraticCurveTo(-2.34, 0.36, -2.24, 0.3);
  return shape;
}

/** The glasshouse seen from the side: windscreen, roof line and rear window. */
function createCabinShape() {
  const shape = new Shape();
  shape.moveTo(-1.5, 0.97);
  shape.lineTo(1.2, 0.97);
  shape.quadraticCurveTo(0.64, 1.38, 0.3, 1.42);
  shape.lineTo(-0.72, 1.41);
  shape.quadraticCurveTo(-1.12, 1.36, -1.5, 0.97);
  return shape;
}

/** Extrudes a side outline across the car, centred on the car's middle. */
function extrudeAcross(shape: Shape, depth: number, bevel: number) {
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 5,
    bevelSize: bevel,
    bevelThickness: bevel * 1.3,
    curveSegments: 28,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/**
 * Pulls the glasshouse in toward the roof (tumblehome), so the cabin leans
 * inward over the doors as a car's does.
 */
function createCabinGeometry() {
  const geometry = extrudeAcross(createCabinShape(), CABIN_DEPTH, 0.05);
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index += 1) {
    const rise = Math.min(1, Math.max(0, (position.getY(index) - 0.97) / 0.45));
    position.setZ(index, position.getZ(index) * (1 - 0.16 * rise));
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A sedan with clear-coated paint, a tinted glasshouse under a painted roof,
 * rubber tyres on alloy rims, and tail lights that flare while it brakes. A
 * simulation moves it through `ref`, so it never re-renders mid-stop.
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
        metalness: 0.4,
        roughness: 0.34,
      }),
    [color]
  );
  const tail = useMemo(
    () =>
      new MeshStandardMaterial({
        color: MATERIAL.brakeLightLens,
        emissive: MATERIAL.brakeLightGlow,
        emissiveIntensity: TAIL_GLOW,
        roughness: 0.18,
      }),
    []
  );
  const body = useMemo(
    () => extrudeAcross(createBodyShape(), BODY_DEPTH, 0.06),
    []
  );
  const cabin = useMemo(createCabinGeometry, []);

  useEffect(
    () => () => {
      body.dispose();
      cabin.dispose();
      tail.dispose();
      paint.dispose();
    },
    [body, cabin, paint, tail]
  );

  useImperativeHandle(ref, () => ({
    place: (distance, braking) => {
      car.current?.position.setX(distance);
      const turn = -distance / SEDAN.wheelRadius;
      Arr.forEach(wheels.current, (wheel) => {
        wheel.rotation.z = turn;
      });
      tail.emissiveIntensity = braking ? BRAKE_GLOW : TAIL_GLOW;
    },
  }));

  return (
    <group ref={car}>
      <mesh castShadow geometry={body} material={paint} receiveShadow></mesh>
      <mesh castShadow geometry={cabin}>
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.02}
          color={MATERIAL.tintedGlass}
          envMapIntensity={1.6}
          metalness={0.55}
          roughness={0.04}
        />
      </mesh>
      <GroundShadow />
      <mesh castShadow material={paint} position={[-0.2, 1.425, 0]}>
        <boxGeometry args={[1.0, 0.05, CABIN_DEPTH * 0.86]} />
      </mesh>
      <mesh material={paint} position={[-0.22, 1.19, 0]}>
        <boxGeometry args={[0.09, 0.44, CABIN_DEPTH * 0.96]} />
      </mesh>

      {Arr.map([1, -1] as const, (side) => (
        <group key={`lights-${side}`}>
          <mesh position={[2.27, 0.73, side * 0.6]}>
            <boxGeometry args={[0.1, 0.11, 0.36]} />
            <meshStandardMaterial
              color={MATERIAL.headlightLens}
              emissive={MATERIAL.headlightGlow}
              emissiveIntensity={0.8}
              roughness={0.08}
            />
          </mesh>
          <mesh material={tail} position={[-2.3, 0.81, side * 0.62]}>
            <boxGeometry args={[0.08, 0.12, 0.4]} />
          </mesh>
          <mesh
            material={paint}
            position={[0.98, 1.04, side * (SEDAN.width / 2 + 0.04)]}
          >
            <boxGeometry args={[0.18, 0.1, 0.12]} />
          </mesh>
        </group>
      ))}

      <mesh material={tail} position={[-1.42, 1.02, 0]}>
        <boxGeometry args={[0.04, 0.04, 0.5]} />
      </mesh>
      <mesh position={[-2.36, 0.52, 0]}>
        <boxGeometry args={[0.04, 0.12, 0.48]} />
        <meshStandardMaterial color={MATERIAL.numberPlate} roughness={0.4} />
      </mesh>
      <mesh position={[2.35, 0.48, 0]}>
        <boxGeometry args={[0.04, 0.16, 0.8]} />
        <meshStandardMaterial color={MATERIAL.grille} roughness={0.5} />
      </mesh>

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
            ref={(wheel) => {
              if (wheel) {
                wheels.current[index] = wheel;
              }
            }}
          >
            <Wheel side={side} />
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

/** A tyre on a five-spoke alloy rim, turned so its face looks outward. */
function Wheel({ side }: { readonly side: 1 | -1 }) {
  return (
    <group rotation={[side > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]}>
      <mesh castShadow>
        <latheGeometry args={[TYRE_PROFILE, 40]} />
        <meshStandardMaterial color={MATERIAL.tyre} roughness={0.9} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.215, 0.215, 0.16, 40]} />
        <meshStandardMaterial
          color={MATERIAL.rimDark}
          metalness={0.9}
          roughness={0.4}
        />
      </mesh>
      {Arr.map(Arr.range(0, 4), (spoke) => (
        <group key={spoke} rotation={[0, (spoke * 2 * Math.PI) / 5, 0]}>
          <mesh position={[0.11, -0.09, 0]}>
            <boxGeometry args={[0.2, 0.03, 0.05]} />
            <meshStandardMaterial
              color={MATERIAL.rimBright}
              metalness={1}
              roughness={0.22}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.03, 20]} />
        <meshStandardMaterial
          color={MATERIAL.chrome}
          metalness={1}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}
