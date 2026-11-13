import { useFrame } from "@react-three/fiber";
import { getAtomSceneColors } from "@repo/design-system/components/contents/chemistry/color";
import type { getMolecule } from "@repo/design-system/components/contents/chemistry/molecule/catalog";
import { ELEMENTS } from "@repo/design-system/components/contents/chemistry/molecule/elements";
import {
  length,
  type Point,
  scale,
} from "@repo/design-system/components/contents/chemistry/molecule/geometry";
import {
  AtomBall,
  atomRadius,
  BondSticks,
  type ModelStyle,
  placeBond,
} from "@repo/design-system/components/contents/chemistry/molecule/model";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { useTheme } from "@repo/design-system/providers/theme";
import { Array as Arr, Option, Result } from "effect";
import { createRef, useMemo } from "react";
import type { Group, Mesh } from "three";

/** A drawn molecule, as the catalog builds it. */
export type Molecule = Result.Result.Success<ReturnType<typeof getMolecule>>;

/** How many times a second a molecule's bonds stretch while the card plays. */
const VIBRATION_HERTZ = 1.1;

/** How far hydrogen, the lightest atom, moves in one stretch, in scene units. */
const VIBRATION_REACH = 0.05;

/**
 * Where one atom stands at time `seconds` of a breathing stretch: every atom
 * moves in and out along the line from the molecule's middle, and a lighter
 * atom moves farther, by one over the square root of its mass, as the atoms of
 * a real stretching bond do.
 */
function vibrate(
  position: Point,
  mass: number,
  seconds: number,
  phase: number
): Point {
  const reach = length(position);
  if (reach < 1e-6) {
    return position;
  }
  const stretch =
    (VIBRATION_REACH / Math.sqrt(mass)) *
    Math.sin(2 * Math.PI * VIBRATION_HERTZ * seconds + phase);
  return scale(position, 1 + stretch / reach);
}

/** How far the molecule reaches from its middle, its outermost atom included. */
export function moleculeReach(molecule: Molecule, style: ModelStyle) {
  return Arr.reduce(molecule.atoms, 0, (reach, atom) =>
    Math.max(reach, length(atom.position) + atomRadius(atom.element, style))
  );
}

/**
 * One molecule in the lab: polished atoms on two-colored sticks, or the atoms
 * at their true size, each named by its symbol. While the card plays, its
 * bonds stretch and relax, lighter atoms swinging farther.
 */
export function MoleculeScene({
  molecule,
  style,
}: {
  readonly molecule: Molecule;
  readonly style: ModelStyle;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const colors = getAtomSceneColors(resolvedTheme);
  const atomRefs = useMemo(
    () => Arr.map(molecule.atoms, () => createRef<Mesh>()),
    [molecule]
  );
  const bondRefs = useMemo(
    () => Arr.map(molecule.bonds, () => createRef<Group>()),
    [molecule]
  );

  useFrame((state) => {
    const seconds = playing ? state.clock.elapsedTime : 0;
    const positions = Arr.map(molecule.atoms, (atom, index) =>
      vibrate(
        atom.position,
        ELEMENTS[atom.element].mass,
        seconds,
        index * 0.9
      )
    );
    for (const [ref, position] of Arr.zip(atomRefs, positions)) {
      ref.current?.position.set(position[0], position[1], position[2]);
    }
    for (const [bond, ref] of Arr.zip(molecule.bonds, bondRefs)) {
      const ends = Option.all([
        Arr.get(positions, bond.from),
        Arr.get(positions, bond.to),
      ]);
      if (ref.current !== null && Option.isSome(ends)) {
        placeBond(ref.current, ends.value);
      }
    }
  });

  return (
    <group>
      {Arr.map(Arr.zip(molecule.atoms, atomRefs), ([atom, ref], index) => (
        <AtomBall
          element={atom.element}
          key={`atom-${index}-${atom.element}`}
          position={atom.position}
          ref={ref}
          style={style}
        />
      ))}
      {style === "ball"
        ? Arr.map(Arr.zip(molecule.bonds, bondRefs), ([bond, ref]) => (
            <BondSticks
              elements={bond.elements}
              key={`bond-${bond.from}-${bond.to}`}
              order={bond.order}
              ref={ref}
            />
          ))
        : null}
      {Arr.map(molecule.atoms, (atom, index) => (
        <ThreeLabel
          color={colors.text}
          fontSize="compact"
          gap={atomRadius(atom.element, style) + 0.12}
          key={`label-${index}-${atom.element}`}
          occlude
          position={atom.position}
        >
          <InlineMath math={`\\mathrm{${atom.element}}`} />
        </ThreeLabel>
      ))}
    </group>
  );
}

/**
 * Frames the molecule from slightly above and to the side, close enough that
 * its outermost atom fills about two thirds of the view.
 */
export function MoleculeCamera({ reach }: { readonly reach: number }) {
  const distance = Math.max(2.4, reach * 3.4);
  return (
    <CameraControls
      cameraPosition={[distance * 0.32, distance * 0.28, distance * 0.9]}
      cameraTarget={[0, 0, 0]}
      fov={38}
      maxDistance={distance * 2.2}
      minDistance={reach + 0.6}
    />
  );
}

/** Builds the molecule, or nothing when its catalog entry cannot be placed. */
export function readMolecule(built: ReturnType<typeof getMolecule>) {
  return Result.getOrUndefined(built);
}
