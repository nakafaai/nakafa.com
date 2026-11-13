import {
  ELEMENTS,
  type ElementSymbol,
} from "@repo/design-system/components/contents/chemistry/molecule/elements";
import {
  type Bond,
  dot,
  length,
  PICOMETRES_PER_UNIT,
  type Point,
  scale,
  subtract,
} from "@repo/design-system/components/contents/chemistry/molecule/geometry";
import { Array as Arr } from "effect";
import { type RefObject, useLayoutEffect, useRef } from "react";
import { type Group, Matrix4, type Mesh, Vector3 } from "three";

/** How a molecule is drawn: atoms on sticks, or atoms at their true size. */
export type ModelStyle = "ball" | "fill";

/** The part of its van der Waals radius an atom keeps in each style. */
const ATOM_SCALE = { ball: 0.22, fill: 1 } as const satisfies Record<
  ModelStyle,
  number
>;

/** The radius of one stick of a bond, in scene units. */
const STICK = 0.085;

/** How far apart the sticks of a double or triple bond stand. */
const STICK_GAP = 0.2;

/** An atom's drawn radius in scene units. */
export function atomRadius(element: ElementSymbol, style: ModelStyle) {
  return (ELEMENTS[element].radius / PICOMETRES_PER_UNIT) * ATOM_SCALE[style];
}

/**
 * The sideways offsets of the sticks of one bond: one stick for a single bond,
 * two for a double, and three for a triple, side by side in one plane.
 */
export function stickOffsets(order: Bond["order"]) {
  const span = (order - 1) * STICK_GAP;
  return Arr.map(Arr.range(0, order - 1), (stick) =>
    order === 1 ? 0 : -span / 2 + stick * STICK_GAP
  );
}

/** The atom a bond starts from and the atom it ends at. */
export type BondEnds = readonly [Point, Point];

/**
 * A direction square to the bond `axis`, chosen in the plane that faces the
 * camera, so the sticks of a double bond in a flat molecule lie in its plane.
 */
function sideways(axis: Point): Point {
  const facing: Point = [axis[1], -axis[0], 0];
  const facingLength = length(facing);
  if (facingLength > 1e-6) {
    return scale(facing, 1 / facingLength);
  }
  const lift: Point = [1, 0, 0];
  const along = scale(axis, dot(lift, axis));
  const away = subtract(lift, along);
  return scale(away, 1 / length(away));
}

const basis = new Matrix4();
const xAxis = new Vector3();
const yAxis = new Vector3();
const zAxis = new Vector3();

/**
 * Stands a bond's group between its two atoms: the group's y axis runs from
 * the first atom to the second and spans its length, and its x axis points
 * sideways, where the sticks of a double bond part.
 */
export function placeBond(group: Group, [from, to]: BondEnds) {
  const axis = subtract(to, from);
  const span = length(axis);
  if (span < 1e-6) {
    group.visible = false;
    return;
  }
  group.visible = true;
  const unit = scale(axis, 1 / span);
  const side = sideways(unit);
  yAxis.set(unit[0], unit[1], unit[2]);
  xAxis.set(side[0], side[1], side[2]);
  zAxis.crossVectors(xAxis, yAxis);
  basis.makeBasis(xAxis, yAxis, zAxis);
  group.position.set(from[0], from[1], from[2]);
  group.quaternion.setFromRotationMatrix(basis);
  group.scale.set(1, span, 1);
}

/** One glossy atom, drawn the way a polished model-kit ball reflects a room. */
export function AtomBall({
  element,
  opacity = 1,
  position,
  ref,
  style,
}: {
  readonly element: ElementSymbol;
  readonly opacity?: number;
  readonly position: Point;
  readonly ref?: RefObject<Mesh | null> | null;
  readonly style: ModelStyle;
}) {
  const radius = atomRadius(element, style);

  return (
    <mesh castShadow position={position} ref={ref ?? null} scale={radius}>
      <sphereGeometry args={[1, 48, 32]} />
      <meshPhysicalMaterial
        clearcoat={0.8}
        clearcoatRoughness={0.14}
        color={ELEMENTS[element].color}
        depthWrite={opacity === 1}
        metalness={0}
        opacity={opacity}
        roughness={0.34}
        transparent={opacity < 1}
      />
    </mesh>
  );
}

/**
 * One bond as sticks in a unit group that `placeBond` stands between its
 * atoms: each stick is two halves, each in the color of the atom it meets,
 * as a model kit's sticks are drawn in chemistry books.
 */
export function BondSticks({
  elements,
  opacity = 1,
  order,
  ref,
}: {
  readonly elements: readonly [ElementSymbol, ElementSymbol];
  readonly opacity?: number;
  readonly order: Bond["order"];
  readonly ref: RefObject<Group | null>;
}) {
  return (
    <group ref={ref}>
      {Arr.map(stickOffsets(order), (offset) => (
        <group key={offset} position={[offset, 0, 0]}>
          {Arr.map([0, 1] as const, (half) => (
            <mesh castShadow key={half} position={[0, 0.25 + half * 0.5, 0]}>
              <cylinderGeometry args={[STICK, STICK, 0.5, 20, 1]} />
              <meshPhysicalMaterial
                clearcoat={0.6}
                clearcoatRoughness={0.2}
                color={ELEMENTS[elements[half]].color}
                depthWrite={opacity === 1}
                opacity={opacity}
                roughness={0.4}
                transparent={opacity < 1}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/**
 * A bond that never moves, stood between its atoms once when it mounts, as
 * the faint outline of a molecule before or after a reaction.
 */
export function FixedBond({
  bond,
  ends,
  opacity,
}: {
  readonly bond: Bond;
  readonly ends: BondEnds;
  readonly opacity: number;
}) {
  const ref = useRef<Group>(null);

  useLayoutEffect(() => {
    if (ref.current !== null) {
      placeBond(ref.current, ends);
    }
  }, [ends]);

  return (
    <BondSticks
      elements={bond.elements}
      opacity={opacity}
      order={bond.order}
      ref={ref}
    />
  );
}
