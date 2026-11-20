import { useFrame } from "@react-three/fiber";
import {
  CENTRES,
  FRONT,
  LENGTH,
  reach,
} from "@repo/design-system/components/contents/biology/muscle/bundle";
import {
  AROUND,
  arcs,
  columnWidth,
  cutNuclei,
  NUCLEUS,
} from "@repo/design-system/components/contents/biology/muscle/nuclei";
import { usePose } from "@repo/design-system/components/contents/biology/muscle/pose";
import { useFibreMaterials } from "@repo/design-system/components/contents/biology/muscle/shading";
import {
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";
import { MUSCLE_COLORS } from "@repo/design-system/lib/material/muscle";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { BufferGeometry, Float32BufferAttribute } from "three";

/** Rings along each fibre, about one a sarcomere. */
const ALONG = 148;

/**
 * Which fibres are slow, type I fibres (0), deep red with myoglobin, and
 * which are fast, type II fibres (1), paler (OpenStax Anatomy and Physiology
 * 2e, 10.5). Human vastus lateralis is about 55 to 68% type I (Roepstorff et
 * al. 2006, J Physiol), so four of the seven are.
 */
const KINDS = [0, 1, 0, 0, 1, 0, 1] as const;

/**
 * The surface of fibre `index` as an indexed grid: its outline from the
 * layout, varied a little along its length, with what the shader needs at
 * each vertex: how far round the outline it lies, the width of the fibre's
 * nucleus cells, the fibre's number and kind, and its own striation phase.
 * The two cut ends are a separate geometry, so the section can be drawn as
 * cut flesh.
 */
function buildFibre(index: number) {
  const centre = CENTRES[index] ?? [0, 0];
  const { perimeter, starts } = arcs(index);
  const radii = Arr.map(Arr.range(0, AROUND - 1), (step) =>
    reach(centre, (step / AROUND) * Math.PI * 2)
  );
  // The ring closes on a repeat of its first point, so the arc round the
  // fibre runs on to the whole perimeter instead of jumping back to zero.
  const columns = Arr.range(0, AROUND);
  const positions = Arr.flatMap(Arr.range(0, ALONG), (ring) => {
    const along = -FRONT + (LENGTH * ring) / ALONG;
    return Arr.flatMap(columns, (column) => {
      const step = column % AROUND;
      const angle = (step / AROUND) * Math.PI * 2;
      const radius =
        (radii[step] ?? 0) *
        (1 -
          0.006 *
            valueNoise(along * 0.25 + index * 7, step * 0.18 + index * 3, 64));
      return [
        along,
        centre[0] + Math.cos(angle) * radius,
        centre[1] + Math.sin(angle) * radius,
      ];
    });
  });
  const width = AROUND + 1;
  const indices = Arr.flatMap(Arr.range(0, ALONG - 1), (ring) =>
    Arr.flatMap(Arr.range(0, AROUND - 1), (step) => {
      const a = ring * width + step;
      const c = (ring + 1) * width + step;
      return [a, a + 1, c, c, a + 1, c + 1];
    })
  );
  const vertices = (ALONG + 1) * width;
  const each = (value: number) =>
    new Float32BufferAttribute(
      Arr.map(Arr.range(1, vertices), () => value),
      1
    );
  const kind = KINDS[index] ?? 0;
  const side = new BufferGeometry();
  side.setAttribute("position", new Float32BufferAttribute(positions, 3));
  side.setAttribute(
    "aArc",
    new Float32BufferAttribute(
      Arr.flatMap(Arr.range(0, ALONG), () => [...starts, perimeter]),
      1
    )
  );
  side.setAttribute("aColumn", each(columnWidth(perimeter)));
  side.setAttribute("aFibre", each(index));
  side.setAttribute("aKind", each(kind));
  side.setAttribute("aPhase", each(hashUnit(index, 91)));
  side.setIndex(indices);
  side.computeVertexNormals();
  closeSeam(side);
  return { ends: buildEnds(positions, kind), side };
}

/**
 * Gives the two copies of each ring's first point one shared normal, so the
 * surface shades smoothly across the seam where the ring closes.
 */
function closeSeam(side: BufferGeometry) {
  const normals = side.getAttribute("normal");
  const width = AROUND + 1;
  for (const ring of Arr.range(0, ALONG)) {
    const first = ring * width;
    const last = first + AROUND;
    const x = normals.getX(first) + normals.getX(last);
    const y = normals.getY(first) + normals.getY(last);
    const z = normals.getZ(first) + normals.getZ(last);
    const length = Math.hypot(x, y, z);
    normals.setXYZ(first, x / length, y / length, z / length);
    normals.setXYZ(last, x / length, y / length, z / length);
  }
}

/**
 * The two cut ends of a fibre, each a fan from the fibre's middle to the
 * outline its side ends on, facing out of the fascicle, with each vertex's
 * depth into the fibre: 1 at its middle, 0 at the sarcolemma.
 */
function buildEnds(side: readonly number[], kind: number) {
  const ring = (index: number, step: number) => {
    const at = (index * (AROUND + 1) + step) * 3;
    return [side[at] ?? 0, side[at + 1] ?? 0, side[at + 2] ?? 0] as const;
  };
  const middle = (index: number) => {
    const points = Arr.map(Arr.range(0, AROUND - 1), (step) =>
      ring(index, step)
    );
    const sum = Arr.reduce(points, [0, 0, 0], (total, point) => [
      (total[0] ?? 0) + point[0],
      (total[1] ?? 0) + point[1],
      (total[2] ?? 0) + point[2],
    ]);
    return Arr.map(sum, (value) => value / AROUND);
  };
  const ends = [
    { facing: 1, index: ALONG },
    { facing: -1, index: 0 },
  ] as const;
  const positions = Arr.flatMap(ends, ({ index }) => [
    ...middle(index),
    ...Arr.flatMap(Arr.range(0, AROUND - 1), (step) => ring(index, step)),
  ]);
  const normals = Arr.flatMap(ends, ({ facing }) =>
    Arr.flatMap(Arr.range(0, AROUND), () => [facing, 0, 0])
  );
  const depths = Arr.flatMap(ends, () => [
    1,
    ...Arr.map(Arr.range(0, AROUND - 1), () => 0),
  ]);
  const indices = Arr.flatMap(ends, ({ facing }, end) =>
    Arr.flatMap(Arr.range(0, AROUND - 1), (step) => {
      const base = end * (AROUND + 1);
      const here = base + 1 + step;
      const next = base + 1 + ((step + 1) % AROUND);
      return facing > 0 ? [base, here, next] : [base, next, here];
    })
  );
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("aDepth", new Float32BufferAttribute(depths, 1));
  geometry.setAttribute(
    "aKind",
    new Float32BufferAttribute(
      Arr.map(depths, () => kind),
      1
    )
  );
  geometry.setIndex(indices);
  return geometry;
}

/**
 * The fascicle's seven fibres, striated and multinucleate, cut square at both
 * ends. They shorten and swell together as the scene's pose contracts them,
 * towards the front cut, which stays put, and their stripes and cut faces
 * follow the sarcomere length and the lactic acid of the moment.
 */
export function Fibres() {
  const pose = usePose();
  const group = useRef<Group>(null);
  const { materials, uniforms } = useFibreMaterials(-FRONT);
  const fibres = useMemo(
    () =>
      Arr.map(Arr.range(0, CENTRES.length - 1), (index) => ({
        index,
        ...buildFibre(index),
      })),
    []
  );
  useEffect(
    () => () => {
      Arr.forEach(fibres, (fibre) => {
        fibre.side.dispose();
        fibre.ends.dispose();
      });
    },
    [fibres]
  );

  useFrame(() => {
    const now = pose.current;
    uniforms.uSarcomere.value = now.sarcomere;
    uniforms.uLactic.value = now.lactic;
    group.current?.position.setX(now.shift);
    group.current?.scale.set(now.stretch, now.swell, now.swell);
  });

  return (
    <group ref={group}>
      {Arr.map(fibres, (fibre) => (
        <group key={fibre.index}>
          <mesh
            castShadow
            geometry={fibre.side}
            material={materials.side}
            receiveShadow
          />
          <mesh geometry={fibre.ends} material={materials.end} receiveShadow />
        </group>
      ))}
      <Sections />
    </group>
  );
}

/**
 * The nuclei the front cut passes through, seen as flattened ovals at the
 * edge of each fibre's section, just under the sarcolemma, each as wide as
 * the cut finds it.
 */
function Sections() {
  const sections = useMemo(
    () =>
      Arr.flatMap(CENTRES, (centre, index) =>
        Arr.map(cutNuclei(index, FRONT, -FRONT), ({ angle, share }, slot) => {
          const depth = reach(centre, angle) - 0.1;
          return {
            angle,
            key: `${index}-${slot}`,
            position: [
              FRONT,
              centre[0] + Math.cos(angle) * depth,
              centre[1] + Math.sin(angle) * depth,
            ] as const,
            width: (NUCLEUS.width / 2) * share,
          };
        })
      ),
    []
  );
  return Arr.map(sections, (section) => (
    <mesh
      key={section.key}
      position={section.position}
      rotation={[section.angle, 0, 0]}
      scale={[0.012, 0.09, section.width]}
    >
      <sphereGeometry args={[1, 20, 12]} />
      <meshPhysicalMaterial
        clearcoat={0.5}
        color={MUSCLE_COLORS.nucleus}
        roughness={0.5}
      />
    </mesh>
  ));
}
