import { useFrame, useThree } from "@react-three/fiber";
import {
  BLOCK,
  LYMPH,
  LYMPH_PATH,
  outer,
} from "@repo/design-system/components/contents/biology/capillary/bed";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { CAPILLARY_COLORS } from "@repo/design-system/lib/material/capillary";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Matrix4,
  MeshPhysicalMaterial,
  Plane,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** The lymph capillary's radius and length, in scene units. */
const RADIUS = outer(LYMPH);
const LENGTH = LYMPH_PATH.end[0] - LYMPH_PATH.start[0];

/** How many endothelial cells run round the lymph capillary, and how long each is along it. */
const AROUND = 7;
const TILE = 3.1;

/** How far each cell reaches past its neighbours, as a share of its own width or length. */
const OVERLAP = 0.2;

/** The angle one cell spans round the tube, overlap included, in radians. */
const SPAN = ((Math.PI * 2) / AROUND) * (1 + OVERLAP);

/** How many rings of cells line the lymph capillary. */
const RINGS = Math.ceil(LENGTH / (TILE * (1 - OVERLAP))) + 1;

/** The block's right face, which cuts the lymph capillary open. */
const RIGHT = new Plane(new Vector3(-1, 0, 0), BLOCK.right);

/**
 * One oak-leaf endothelial cell of the lymph capillary, curved to the tube:
 * lobed at its edges as these cells are, its overlapping edge tucked under
 * the next cell's, and its nucleus bulging at its middle. Drawn about the
 * x axis with its middle on top, so each copy is only turned and moved.
 */
function useOakLeaf() {
  const geometry = useMemo(() => {
    const rings = 9;
    const sectors = 48;
    const positions = new Float32Array((rings + 1) * (sectors + 1) * 3);
    const colors = new Float32Array((rings + 1) * (sectors + 1) * 3);
    const point = new Vector3();
    const wall = new Color(CAPILLARY_COLORS.lymphWall);
    const border = new Color(CAPILLARY_COLORS.cleft);
    const nucleus = new Color(CAPILLARY_COLORS.endotheliumNucleus);
    const color = new Color();
    for (const ring of Arr.range(0, rings)) {
      for (const sector of Arr.range(0, sectors)) {
        const turn = (sector / sectors) * Math.PI * 2;
        const lobe = 1 - 0.14 * (0.5 + 0.5 * Math.cos(turn * 6 + 0.7));
        const reach = (ring / rings) * lobe;
        const along = Math.cos(turn) * reach * (TILE / 2) * (1 + OVERLAP);
        const round = Math.sin(turn) * reach * (SPAN / 2);
        const share = round / SPAN + 0.5;
        const tuck = 0.035 - 0.07 * share + 0.02 - 0.04 * (along / TILE + 0.5);
        const middle = 1 - (ring / rings) ** 2;
        const radius = RADIUS + tuck + 0.05 * middle * middle;
        const index = ring * (sectors + 1) + sector;
        point
          .set(along, radius * Math.cos(round), radius * Math.sin(round))
          .toArray(positions, index * 3);
        const edge = Math.max(0, (ring / rings - 0.72) / 0.28);
        color
          .copy(wall)
          .lerp(border, 0.75 * edge)
          .lerp(nucleus, middle > 0.93 ? 0.55 : 0);
        color.toArray(colors, index * 3);
      }
    }
    const indices = Arr.flatMap(Arr.range(0, rings - 1), (ring) =>
      Arr.flatMap(Arr.range(0, sectors - 1), (sector) => {
        const a = ring * (sectors + 1) + sector;
        const b = a + sectors + 1;
        return [a, a + 1, b, b, a + 1, b + 1];
      })
    );
    const leaf = new BufferGeometry();
    leaf.setAttribute("position", new BufferAttribute(positions, 3));
    leaf.setAttribute("color", new BufferAttribute(colors, 3));
    leaf.setIndex(indices);
    leaf.computeVertexNormals();
    return leaf;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/** The fine anchoring filaments that tie the lymph capillary's back flank to the collagen of the floor. */
function useFilaments() {
  const geometry = useMemo(() => {
    const strands = Arr.map(Arr.range(0, 9), (index) => {
      const x = 0.6 + index * 1.45 + 0.4 * hashUnit(index, 3);
      const angle = -Math.PI / 2 - 0.35 - 0.7 * hashUnit(index, 5);
      const start = new Vector3(
        x,
        Math.cos(angle) * RADIUS,
        Math.sin(angle) * RADIUS
      );
      const out = 0.9 + 0.6 * hashUnit(index, 7);
      const end = new Vector3(
        x + 0.3 * (hashUnit(index, 9) - 0.5),
        -RADIUS + 0.01,
        start.z - out
      );
      const bend = start
        .clone()
        .lerp(end, 0.5)
        .add(new Vector3(0, 0.25, -0.15));
      return new TubeGeometry(
        new CatmullRomCurve3([start, bend, end]),
        16,
        0.018,
        5,
        false
      );
    });
    const merged = mergeGeometries(strands);
    Arr.forEach(strands, (strand) => strand.dispose());
    return merged;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * The lymph capillary: a blind-ended tube of overlapping oak-leaf
 * endothelial cells, about 50 micrometres across, anchored to the collagen
 * around it by fine filaments. The cells' free edges on the side the tissue
 * fluid comes from tip inward like little valves: the more fluid the
 * tissue holds, the harder the filaments pull and the wider the flaps open,
 * while lymph inside cannot push them back out (OpenStax Anatomy and
 * Physiology 2e, 21.1).
 *
 * @param inflow - How much tissue fluid is draining in, from 0 to 1
 */
export function LymphCapillary({ inflow }: { readonly inflow: number }) {
  const leaf = useOakLeaf();
  const filaments = useFilaments();
  const tiles = useRef<InstancedMesh>(null);
  const shown = useRef(inflow);
  const invalidate = useThree((state) => state.invalidate);
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        clearcoat: 0.4,
        clearcoatRoughness: 0.45,
        clippingPlanes: [RIGHT],
        depthWrite: false,
        opacity: 0.5,
        roughness: 0.42,
        sheen: 0.6,
        sheenColor: new Color(CAPILLARY_COLORS.lymphWall),
        side: DoubleSide,
        transparent: true,
        vertexColors: true,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  const dome = useMemo(
    () =>
      new SphereGeometry(
        RADIUS - 0.02,
        40,
        20,
        -Math.PI / 2,
        Math.PI,
        0,
        Math.PI
      ),
    []
  );
  useEffect(() => () => dome.dispose(), [dome]);
  const scratch = useMemo(
    () => ({
      hinge: new Matrix4(),
      matrix: new Matrix4(),
      shift: new Matrix4(),
      turn: new Matrix4(),
    }),
    []
  );
  const count = RINGS * AROUND;

  useFrame(() => {
    const mesh = tiles.current;
    if (mesh === null) {
      return;
    }
    shown.current += (inflow - shown.current) * 0.2;
    const open = 0.1 + 0.3 * shown.current;
    Arr.forEach(Arr.range(0, count - 1), (index) => {
      const ring = Math.floor(index / AROUND);
      const angle =
        ((index % AROUND) + (ring % 2) * 0.5) * ((Math.PI * 2) / AROUND);
      const facing = Math.max(0, Math.sin(angle));
      const flap = open * facing * (0.6 + 0.4 * hashUnit(index, 31));
      const edge = SPAN / 2;
      scratch.hinge
        .makeTranslation(0, RADIUS * Math.cos(edge), -RADIUS * Math.sin(edge))
        .multiply(scratch.turn.makeRotationX(flap))
        .multiply(
          scratch.shift.makeTranslation(
            0,
            -RADIUS * Math.cos(edge),
            RADIUS * Math.sin(edge)
          )
        );
      scratch.matrix
        .makeTranslation(TILE / 2 + ring * TILE * (1 - OVERLAP), 0, 0)
        .multiply(scratch.turn.makeRotationX(angle))
        .multiply(scratch.hinge);
      mesh.setMatrixAt(index, scratch.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (Math.abs(inflow - shown.current) > 0.002) {
      invalidate();
    }
  });

  return (
    <group position={[...LYMPH_PATH.start]}>
      <instancedMesh
        args={[leaf, material, count]}
        frustumCulled={false}
        ref={tiles}
      />
      <mesh geometry={dome}>
        <meshPhysicalMaterial
          clearcoat={0.3}
          clearcoatRoughness={0.45}
          color={CAPILLARY_COLORS.lymphWall}
          depthWrite={false}
          opacity={0.32}
          roughness={0.45}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh geometry={filaments}>
        <meshStandardMaterial
          color={CAPILLARY_COLORS.collagen}
          roughness={0.6}
        />
      </mesh>
      <mesh position={[LENGTH / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry
          args={[RADIUS - 0.12, RADIUS - 0.12, LENGTH, 40, 1, true]}
        />
        <meshPhysicalMaterial
          color={CAPILLARY_COLORS.lymphFluid}
          depthWrite={false}
          opacity={0.08}
          roughness={0.2}
          transparent
        />
      </mesh>
    </group>
  );
}
