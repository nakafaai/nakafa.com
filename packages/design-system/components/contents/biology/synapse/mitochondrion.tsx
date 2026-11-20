import { MITOCHONDRION } from "@repo/design-system/components/contents/biology/synapse/anatomy";
import {
  Membrane,
  useMembrane,
  useMembraneMaterial,
} from "@repo/design-system/components/contents/biology/synapse/membrane";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { SYNAPSE_COLORS } from "@repo/design-system/lib/material/synapse";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { ExtrudeGeometry, Matrix4, Shape } from "three";

/** The mitochondrion's membranes stay smooth enough to read as one organelle. */
function calmOrganelle() {
  return 1;
}

/**
 * A capsule's outline as pairs of radius and height, from one tip round its
 * side to the other, its side swelling and narrowing a little as a living
 * organelle's does.
 */
function capsuleOutline(radius: number, half: number) {
  const cap = (from: number, centre: number) =>
    Arr.map(Arr.range(0, 12), (step) => {
      const angle = from + (step / 12) * (Math.PI / 2);
      return [
        radius * Math.cos(angle),
        centre + radius * Math.sin(angle),
      ] as const;
    });
  const side = Arr.map(Arr.range(1, 19), (step) => {
    const y = -half + (2 * half * step) / 20;
    return [radius * (1 + 0.035 * Math.sin(step * 0.8)), y] as const;
  });
  return Arr.appendAll(
    Arr.appendAll(cap(-Math.PI / 2, -half), side),
    cap(0, half)
  );
}

/**
 * One crista: a fold of the inner membrane about 20 nm thick, rooted along
 * the inner membrane's wall and reaching `share` of the radius past the
 * centre line, its back half kept as the mitochondrion is cut open. It lies
 * across the organelle's long axis, which the lathe draws along y, and
 * ripples as a living fold does.
 */
function crista(radius: number, share: number) {
  const round = 0.5;
  const arc = radius - round;
  const reach = radius * share;
  const back = Math.sqrt(arc ** 2 - reach ** 2);
  const fold = new Shape();
  fold.moveTo(-round, -arc);
  // Round the back of the inner membrane's wall, then a rounded tip that
  // bulges into the matrix, back to the cut.
  Arr.forEach(Arr.range(1, 14), (step) => {
    const angle =
      Math.asin(round / arc) +
      (step / 14) * (Math.acos(reach / arc) - Math.asin(round / arc));
    fold.lineTo(-arc * Math.sin(angle), -arc * Math.cos(angle));
  });
  Arr.forEach(Arr.range(1, 10), (step) => {
    const along = step / 10;
    const bulge = 0.9 * Math.sin(along * Math.PI);
    fold.lineTo(-back + (back - round) * along, -reach + bulge);
  });
  fold.lineTo(-round, -arc);
  const plate = new ExtrudeGeometry(fold, {
    bevelEnabled: true,
    bevelSegments: 5,
    bevelSize: round,
    bevelThickness: round,
    curveSegments: 16,
    depth: 0.7,
  });
  // The fold is drawn with depth across and the radius down, and extruded
  // through its thickness: turn it into the lathe's frame, where the radius
  // runs along x, depth along z and the long axis along y.
  plate.translate(0, 0, -0.35);
  // A fold is never flat: it ripples along the length as it runs back.
  const place = plate.getAttribute("position");
  Arr.forEach(Arr.range(0, place.count - 1), (vertex) => {
    const across = place.getX(vertex);
    const down = place.getY(vertex);
    place.setZ(
      vertex,
      place.getZ(vertex) +
        0.55 * Math.sin(across * 0.9 + share * 9) +
        0.25 * Math.sin(down * 1.3)
    );
  });
  plate.computeVertexNormals();
  return plate.applyMatrix4(
    new Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1)
  );
}

/**
 * The cristae: folds of the inner membrane about 20 nm thick, rooted along
 * its wall and reaching between a third and two thirds across the matrix,
 * from either side in turn, their back halves kept as the mitochondrion is
 * cut open.
 */
function useCristae(radius: number) {
  const folds = useMemo(
    () =>
      Arr.map(Arr.range(0, 6), (index) => ({
        geometry: crista(radius, 0.12 + 0.3 * hashUnit(index, 31)),
        key: index,
        tilt: 0.12 * (hashUnit(index, 37) - 0.5),
        top: index % 2 === 0 ? 1 : -1,
        y:
          -MITOCHONDRION.half +
          1.5 +
          index * ((2 * MITOCHONDRION.half - 3) / 6) +
          0.8 * (hashUnit(index, 41) - 0.5),
      })),
    [radius]
  );
  useEffect(
    () => () => Arr.forEach(folds, (fold) => fold.geometry.dispose()),
    [folds]
  );
  return folds;
}

/**
 * The mitochondrion, cut open along its length: the smooth outer membrane,
 * the inner membrane a little inside it, and the cristae folding in from
 * the inner membrane across the matrix.
 */
export function Mitochondrion() {
  const outerOutline = useMemo(
    () => capsuleOutline(MITOCHONDRION.radius, MITOCHONDRION.half),
    []
  );
  const innerOutline = useMemo(
    () => capsuleOutline(MITOCHONDRION.radius - 1.2, MITOCHONDRION.half - 0.4),
    []
  );
  const outerMembrane = useMembrane({
    calm: calmOrganelle,
    head: SYNAPSE_COLORS.mitochondrion,
    outline: outerOutline,
    seed: 11,
    sweep: "lathe",
    tail: SYNAPSE_COLORS.crista,
    thickness: 0.6,
    turns: 64,
    wave: 0.5,
  });
  const innerMembrane = useMembrane({
    calm: calmOrganelle,
    head: SYNAPSE_COLORS.mitochondrion,
    outline: innerOutline,
    seed: 17,
    sweep: "lathe",
    tail: SYNAPSE_COLORS.crista,
    thickness: 0.6,
    turns: 64,
    wave: 0.4,
  });
  const skin = useMembraneMaterial(
    SYNAPSE_COLORS.mitochondrion,
    SYNAPSE_COLORS.crista
  );
  const matrix = useMembraneMaterial(
    SYNAPSE_COLORS.matrix,
    SYNAPSE_COLORS.mitochondrion,
    0.7
  );
  const fold = useMembraneMaterial(SYNAPSE_COLORS.crista, SYNAPSE_COLORS.tail);
  const cristae = useCristae(MITOCHONDRION.radius - 1.5);

  return (
    <group position={MITOCHONDRION.centre} rotation={[0, 0, -Math.PI / 2]}>
      <Membrane geometry={outerMembrane} inner={skin} outer={skin} />
      <Membrane geometry={innerMembrane} inner={matrix} outer={skin} />
      {Arr.map(cristae, (item) => (
        <mesh
          castShadow
          geometry={item.geometry}
          key={item.key}
          material={fold}
          position={[0, item.y, 0]}
          rotation={[0, 0, (item.top === 1 ? 0 : Math.PI) + item.tilt]}
        />
      ))}
    </group>
  );
}
