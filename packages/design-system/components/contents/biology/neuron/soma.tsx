import {
  TissueMaterial,
  useOwned,
} from "@repo/design-system/components/contents/biology/neuron/tissue";
import {
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";
import { NEURON_COLORS } from "@repo/design-system/lib/material/neuron";
import { Array as Arr, Option, Result } from "effect";
import { useMemo } from "react";
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  Object3D,
  Plane,
  SphereGeometry,
  Vector3,
} from "three";

/**
 * The drawing's scale: one scene unit is 10 micrometres across the fibres
 * and the cell body. An α motor neuron's cell body is about 58 µm across in
 * the adult cat (Cullheim and Ulfhake, via BioNumbers 112111), so it is
 * drawn 2.9 units in radius; the cell is a little flatter front to back.
 */
export const SOMA = {
  centre: new Vector3(-11, 7.4, 0),
  depth: 0.88,
  radius: 2.9,
} as const;

/**
 * Where the front of the cell body is cut away, in units in front of its
 * centre, so the reader looks at a section through it.
 */
const CUT = 1.25;

/** A direction in the drawing's plane, `degrees` round from the right, tipped `lift` toward the reader. */
function heading(degrees: number, lift: number) {
  const angle = (degrees * Math.PI) / 180;
  return new Vector3(Math.cos(angle), Math.sin(angle), lift).normalize();
}

/** The axon hillock: the cone the cell body tapers into toward the axon, free of Nissl substance. */
export const HILLOCK = { direction: heading(-27, 0.08), length: 1.5 } as const;

/**
 * The primary dendrites: motor neuron dendrites leave the cell body all
 * round and run out radially (Cullheim et al., J. Comp. Neurol. 255: 82-96,
 * 1987), each from a tapered root.
 */
export const TRUNKS = Arr.map(
  [
    [26, -0.15, 3.9],
    [106, 0.05, 3.4],
    [146, -0.3, 4.2],
    [186, 0.08, 3.6],
    [226, -0.2, 4],
    [264, 0.02, 3.3],
    [302, -0.32, 3.8],
  ] as const,
  ([degrees, lift, length], index) => ({
    direction: heading(degrees, lift),
    index,
    length,
  })
);

/** How far the cell body's skin lies from its centre in direction `n` (a unit vector), roots and hillock included. */
function reach(n: Vector3) {
  const skin =
    1 +
    0.045 * (valueNoise(n.x * 2.6 + 3, n.y * 2.6 + n.z * 1.9, 64) - 0.5) +
    0.018 * (valueNoise(n.x * 9 + 7, n.y * 9 - n.z * 6, 64) - 0.5);
  const flare = (direction: Vector3, width: number) =>
    Math.max(0, (n.dot(direction) - Math.cos(width)) / (1 - Math.cos(width))) **
    2.6;
  const roots = Arr.reduce(
    TRUNKS,
    0,
    (sum, trunk) => sum + 1.05 * flare(trunk.direction, 0.72)
  );
  return (
    SOMA.radius * skin + roots + HILLOCK.length * flare(HILLOCK.direction, 0.62)
  );
}

/** Whether a point of the cell body's own frame lies inside its skin. */
function inside(point: Vector3) {
  const unflattened = new Vector3(point.x, point.y, point.z / SOMA.depth);
  const distance = unflattened.length();
  return distance < reach(unflattened.divideScalar(distance));
}

/** The cell body's skin: a sphere pushed out by its noise, its dendrite roots and its hillock. */
function useSkin() {
  const geometry = useMemo(() => {
    const sphere = new SphereGeometry(1, 120, 90);
    const position = sphere.getAttribute("position");
    const n = new Vector3();
    for (const index of Arr.range(0, position.count - 1)) {
      n.fromBufferAttribute(position, index).normalize();
      const r = reach(n);
      position.setXYZ(index, n.x * r, n.y * r, n.z * r * SOMA.depth);
    }
    sphere.computeVertexNormals();
    return sphere;
  }, []);
  return useOwned(geometry);
}

/**
 * The outline of the section through the cell body where the cut plane
 * meets its skin, found ray by ray out from the middle of the section.
 */
function outline() {
  return Arr.map(Arr.range(0, 95), (step) => {
    const angle = (step / 96) * Math.PI * 2;
    const ray = new Vector3(Math.cos(angle), Math.sin(angle), 0);
    const at = (distance: number) =>
      new Vector3(ray.x * distance, ray.y * distance, CUT);
    const out = Option.getOrElse(
      Arr.findFirst(Arr.range(1, 160), (tenth) => !inside(at(tenth / 20))),
      () => 160
    );
    const edge = Arr.reduce(
      Arr.range(1, 12),
      [(out - 1) / 20, out / 20] as const,
      ([low, high]) =>
        inside(at((low + high) / 2))
          ? ([(low + high) / 2, high] as const)
          : ([low, (low + high) / 2] as const)
    );
    return at(edge[0]);
  });
}

/** The section's face: a fan from its middle to its outline. */
function useSection(edge: readonly Vector3[]) {
  const geometry = useMemo(() => {
    const positions = new Float32Array((edge.length + 1) * 3);
    const indices = new Uint32Array(edge.length * 3);
    positions.set([0, 0, CUT], 0);
    Arr.forEach(edge, (point, index) => {
      positions.set([point.x, point.y, point.z], (index + 1) * 3);
      indices.set([0, index + 1, ((index + 1) % edge.length) + 1], index * 3);
    });
    const face = new BufferGeometry();
    face.setAttribute("position", new Float32BufferAttribute(positions, 3));
    face.setIndex([...indices]);
    face.computeVertexNormals();
    return face;
  }, [edge]);
  return useOwned(geometry);
}

/** The nucleus, a third of the cell body across as a stained motor neuron shows it, and its nucleolus. */
const NUCLEUS = {
  centre: new Vector3(0.1, 0.2, CUT - 0.5),
  radius: 1.22,
  rise: 0.08,
} as const;

/**
 * Nissl bodies, the clumps of rough endoplasmic reticulum that stain violet,
 * scattered through the cytoplasm of the section but absent from the axon
 * hillock and from the nucleus.
 */
function useNissl(edge: readonly Vector3[]) {
  return useMemo(() => {
    const limit = (angle: number) => {
      const step = Math.round((angle / (Math.PI * 2)) * 96) % 96;
      return Option.match(Arr.get(edge, (step + 96) % 96), {
        onNone: () => SOMA.radius,
        onSome: (point) => Math.hypot(point.x, point.y),
      });
    };
    const hillock = Math.atan2(HILLOCK.direction.y, HILLOCK.direction.x);
    return Arr.filterMap(Arr.range(0, 520), (seed) => {
      const angle = hashUnit(seed, 3) * Math.PI * 2;
      const distance = Math.sqrt(hashUnit(seed, 5)) * limit(angle) * 0.9;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      const nucleus = Math.hypot(x - NUCLEUS.centre.x, y - NUCLEUS.centre.y);
      const away = Math.abs(
        Math.atan2(Math.sin(angle - hillock), Math.cos(angle - hillock))
      );
      const inHillock = away < 0.5 && distance > SOMA.radius * 0.55;
      return nucleus < 1.2 || inHillock
        ? Result.failVoid
        : Result.succeed({
            angle: hashUnit(seed, 9) * Math.PI,
            seed,
            size: 0.05 + 0.08 * hashUnit(seed, 11),
            x,
            y,
          });
    });
  }, [edge]);
}

/**
 * A motor neuron's cell body, its front cut away to show a section as a
 * Nissl stain colours it: violet Nissl bodies through the cytoplasm but not
 * in the hillock, a pale nucleus standing a little proud of the cut, and a
 * dark nucleolus.
 */
export function Soma() {
  const skin = useSkin();
  const edge = useMemo(outline, []);
  const section = useSection(edge);
  const nissl = useNissl(edge);
  const cut = useMemo(
    () => [new Plane(new Vector3(0, 0, -1), SOMA.centre.z + CUT)],
    []
  );
  const nuclearCut = useMemo(
    () => [
      new Plane(new Vector3(0, 0, -1), SOMA.centre.z + CUT + NUCLEUS.rise),
    ],
    []
  );
  const clump = useOwned(useMemo(() => new IcosahedronGeometry(1, 0), []));
  const clumps = useMemo(() => {
    const mesh = new InstancedMesh(clump, undefined, nissl.length);
    const place = new Object3D();
    const shade = new Color();
    Arr.forEach(nissl, (body, index) => {
      place.position.set(body.x, body.y, CUT + 0.015);
      place.rotation.set(0, 0, body.angle);
      place.scale.set(body.size * 1.7, body.size * 0.8, 0.03);
      place.updateMatrix();
      mesh.setMatrixAt(index, place.matrix);
      mesh.setColorAt(
        index,
        shade.setScalar(0.7 + 0.5 * hashUnit(body.seed, 13))
      );
    });
    return mesh;
  }, [clump, nissl]);
  useOwned(clumps);
  const disc = Math.sqrt(
    NUCLEUS.radius ** 2 - (CUT + NUCLEUS.rise - NUCLEUS.centre.z) ** 2
  );

  return (
    <group position={SOMA.centre}>
      <mesh castShadow geometry={skin} receiveShadow>
        <TissueMaterial clip={cut} color={NEURON_COLORS.neurite} />
      </mesh>
      <mesh geometry={section} receiveShadow>
        <TissueMaterial
          coat={0.6}
          color={NEURON_COLORS.cytoplasm}
          roughness={0.42}
          side={DoubleSide}
        />
      </mesh>
      <primitive object={clumps}>
        <TissueMaterial
          coat={0.5}
          color={NEURON_COLORS.nissl}
          roughness={0.5}
          sheen={NEURON_COLORS.nisslSheen}
        />
      </primitive>
      <mesh position={NUCLEUS.centre}>
        <sphereGeometry args={[NUCLEUS.radius, 64, 48]} />
        <TissueMaterial
          clip={nuclearCut}
          color={NEURON_COLORS.envelope}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[NUCLEUS.centre.x, NUCLEUS.centre.y, CUT + NUCLEUS.rise]}>
        <circleGeometry args={[disc, 64]} />
        <TissueMaterial
          coat={0.7}
          color={NEURON_COLORS.nucleus}
          roughness={0.35}
        />
      </mesh>
      <mesh
        position={[
          NUCLEUS.centre.x + 0.22,
          NUCLEUS.centre.y + 0.1,
          CUT + NUCLEUS.rise,
        ]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <sphereGeometry args={[0.34, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <TissueMaterial
          coat={0.8}
          color={NEURON_COLORS.nucleolus}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}
