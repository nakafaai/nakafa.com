import { Instances } from "@repo/design-system/components/contents/biology/instances";
import {
  EnvelopeMaterial,
  useBumpySphere,
  useClipping,
  useLocalPlanes,
} from "@repo/design-system/components/contents/biology/surface";
import { spikeAnchor } from "@repo/design-system/components/contents/biology/virus/binding";
import {
  capsomeres,
  elongate,
  helicalSubunits,
  helixPath,
  icosahedronFaces,
} from "@repo/design-system/components/contents/biology/virus/capsid";
import { VIRION_COLORS } from "@repo/design-system/lib/material/virion";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  type Group,
  type Plane,
  Vector3,
} from "three";

/**
 * Tobacco mosaic virus at 1 unit to 100 nm: a rod 18 nm wide whose coat
 * proteins climb a helix 2.3 nm a turn, 16.3 to a turn. The card shows a
 * stretch 110 nm long of the 300 nm rod.
 */
const TMV = { length: 1.1, perTurn: 16.3, pitch: 0.023, radius: 0.09 } as const;

/** How far the coat is stripped from the rod's right end to show the RNA it wraps. */
const TMV_BARE = 0.12;

/**
 * A helical virus such as tobacco mosaic virus: some 800 wedge-shaped coat
 * proteins wound round a single strand of RNA that follows the same helix
 * deep in the rod, stripped from one end to show it.
 */
export function HelicalVirusModel({ scale = 1 }: { scale?: number }) {
  const subunits = useMemo(
    () =>
      Arr.map(
        Arr.filter(
          helicalSubunits(TMV),
          ({ x }) => x < TMV.length / 2 - TMV_BARE
        ),
        ({ angle, x }) => ({
          position: [
            x,
            Math.cos(angle) * TMV.radius * 0.62,
            Math.sin(angle) * TMV.radius * 0.62,
          ] as const,
          scale: [0.0125, 0.034, 0.0125] as const,
          up: [0, Math.cos(angle), Math.sin(angle)] as const,
        })
      ),
    []
  );
  const rna = useMemo(() => {
    const turns = TMV.length / TMV.pitch;
    return new CatmullRomCurve3(
      Arr.map(
        helixPath({ length: TMV.length, phase: 0, radius: 0.04, turns }),
        ([x, y, z]) => new Vector3(y, x, z)
      )
    );
  }, []);
  return (
    <group scale={scale}>
      <Instances placements={subunits}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshPhysicalMaterial
          clearcoat={0.35}
          clearcoatRoughness={0.4}
          color={VIRION_COLORS.tmvCoat}
          roughness={0.55}
        />
      </Instances>
      <mesh castShadow>
        <tubeGeometry args={[rna, 1600, 0.006, 5, false]} />
        <meshStandardMaterial
          color={VIRION_COLORS.nucleicAcid}
          roughness={0.45}
        />
      </mesh>
    </group>
  );
}

/** An icosahedron's flat faces at circumradius 1, stretched along its axis by `extra`. */
export function useFacetedShell(extra = 0) {
  const geometry = useMemo(() => {
    const corners = Arr.flatMap(icosahedronFaces(), (face) =>
      Arr.flatMap(face, (corner) => elongate(corner, extra))
    );
    const shell = new BufferGeometry();
    shell.setAttribute("position", new Float32BufferAttribute(corners, 3));
    shell.computeVertexNormals();
    return shell;
  }, [extra]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

/**
 * An icosahedral capsid of circumradius `radius`: a faceted protein shell
 * tiled with hexagonal hexons and, at its twelve vertices, pentagonal
 * pentons, `frequency` capsomeres along each edge, opened by `clip`.
 */
export function IcosahedralCapsid({
  clip,
  frequency,
  radius,
}: {
  readonly clip: readonly Plane[] | undefined;
  readonly frequency: number;
  readonly radius: number;
}) {
  const shell = useFacetedShell();
  const size = (radius * 1.0515) / frequency;
  const spots = useMemo(() => {
    const placed = Arr.map(capsomeres(frequency), (spot, index) => ({
      kind: spot.kind,
      position: [
        spot.position[0] * radius + spot.normal[0] * size * 0.1,
        spot.position[1] * radius + spot.normal[1] * size * 0.1,
        spot.position[2] * radius + spot.normal[2] * size * 0.1,
      ] as const,
      spin: index * 0.37,
      up: spot.normal,
    }));
    return {
      hexons: Arr.filter(placed, ({ kind }) => kind === "hexon"),
      pentons: Arr.filter(placed, ({ kind }) => kind === "penton"),
    };
  }, [frequency, radius, size]);
  return (
    <group>
      <mesh geometry={shell} receiveShadow scale={radius * 0.96}>
        <EnvelopeMaterial
          clip={clip}
          color={VIRION_COLORS.capsidProtein}
          wedge
        />
      </mesh>
      <Instances placements={spots.hexons}>
        <cylinderGeometry args={[size * 0.4, size * 0.48, size * 0.28, 6]} />
        <EnvelopeMaterial
          clip={clip}
          color={VIRION_COLORS.capsidProtein}
          wedge
        />
      </Instances>
      <Instances placements={spots.pentons}>
        <cylinderGeometry args={[size * 0.36, size * 0.46, size * 0.32, 5]} />
        <EnvelopeMaterial clip={clip} color={VIRION_COLORS.penton} wedge />
      </Instances>
    </group>
  );
}

/**
 * Adenovirus at 1 unit to 250 nm: a capsid about 90 nm across built from 240
 * hexons and 12 pentons (triangulation number 25), with no envelope, and a
 * fibre with a knob standing out from every penton.
 */
export function PolyhedralVirusModel({ scale = 1 }: { scale?: number }) {
  const radius = 0.36;
  const fibres = useMemo(
    () => Arr.filter(capsomeres(5), ({ kind }) => kind === "penton"),
    []
  );
  return (
    <group scale={scale}>
      <IcosahedralCapsid clip={undefined} frequency={5} radius={radius} />
      <Instances
        placements={Arr.map(fibres, ({ normal, position }) => ({
          position: [
            position[0] * radius + normal[0] * 0.13,
            position[1] * radius + normal[1] * 0.13,
            position[2] * radius + normal[2] * 0.13,
          ] as const,
          up: normal,
        }))}
      >
        <cylinderGeometry args={[0.006, 0.008, 0.2, 6]} />
        <meshStandardMaterial
          color={VIRION_COLORS.adenoFibre}
          roughness={0.55}
        />
      </Instances>
      <Instances
        placements={Arr.map(fibres, ({ normal, position }) => ({
          position: [
            position[0] * radius + normal[0] * 0.24,
            position[1] * radius + normal[1] * 0.24,
            position[2] * radius + normal[2] * 0.24,
          ] as const,
          scale: [1, 0.75, 1] as const,
          up: normal,
        }))}
      >
        <sphereGeometry args={[0.024, 14, 10]} />
        <meshPhysicalMaterial
          clearcoat={0.4}
          color={VIRION_COLORS.adenoFibre}
          roughness={0.5}
        />
      </Instances>
    </group>
  );
}

/** The quarter of the influenza virion facing the reader is cut away to show what it carries. */
const INFLUENZA_CUT = [
  [-1, 0, 0],
  [0, 0, -1],
] as const;

/** Influenza at 1 unit to 140 nm: an envelope about 100 nm across. */
const INFLUENZA = { haemagglutinin: 300, neuraminidase: 48, radius: 0.36 };

/**
 * The eight ribonucleoprotein segments of the influenza genome, standing in
 * the "7 + 1" bundle seen in cryo-electron tomograms: seven round one, of
 * lengths that follow the segments' sizes.
 */
const SEGMENTS = Arr.map(Arr.range(0, 7), (index) => {
  const angle = (index / 7) * Math.PI * 2;
  const around = index === 7 ? 0 : 0.075;
  return {
    id: index,
    length: 0.42 - index * 0.03,
    position: [
      Math.cos(angle) * around,
      0.02,
      Math.sin(angle) * around,
    ] as const,
  };
});

/**
 * An enveloped virus such as influenza: a lipid envelope over a layer of
 * matrix protein, studded with some 300 rod-shaped haemagglutinin trimers
 * and fewer mushroom-shaped neuraminidase tetramers, about 13 nm tall, with a
 * quarter cut away to show the eight ribonucleoprotein segments inside.
 */
export function EnvelopedVirusModel({ scale = 1 }: { scale?: number }) {
  useClipping();
  const body = useRef<Group>(null);
  const cut = useLocalPlanes(body, INFLUENZA_CUT);
  const envelope = useBumpySphere(INFLUENZA.radius, 5, 0.025);
  const spikes = useMemo(() => {
    const total = INFLUENZA.haemagglutinin + INFLUENZA.neuraminidase;
    const all = Arr.map(Arr.range(0, total - 1), (index) => ({
      direction: spikeAnchor(index, total),
      na: index % 7 === 3,
    }));
    const place =
      (lift: number, flat: boolean) =>
      ({ direction }: { direction: readonly [number, number, number] }) => ({
        position: [
          direction[0] * (INFLUENZA.radius + lift),
          direction[1] * (INFLUENZA.radius + lift),
          direction[2] * (INFLUENZA.radius + lift),
        ] as const,
        scale: flat ? ([1, 0.55, 1] as const) : ([1, 1, 1] as const),
        up: direction,
      });
    const ha = Arr.filter(all, ({ na }) => !na);
    const na = Arr.filter(all, ({ na: isNa }) => isNa);
    return {
      ha: Arr.map(ha, place(0.035, false)),
      naHead: Arr.map(na, place(0.07, true)),
      naStalk: Arr.map(na, place(0.03, false)),
    };
  }, []);
  return (
    <group scale={scale}>
      <group ref={body}>
        <mesh castShadow geometry={envelope} receiveShadow>
          <EnvelopeMaterial
            clip={cut}
            color={VIRION_COLORS.viralEnvelope}
            wedge
          />
        </mesh>
        <mesh scale={0.93}>
          <sphereGeometry args={[INFLUENZA.radius, 48, 32]} />
          <EnvelopeMaterial
            clip={cut}
            color={VIRION_COLORS.matrixProtein}
            wedge
          />
        </mesh>
        <Instances placements={spikes.ha}>
          <cylinderGeometry args={[0.016, 0.009, 0.07, 7]} />
          <EnvelopeMaterial
            clip={cut}
            color={VIRION_COLORS.haemagglutinin}
            wedge
          />
        </Instances>
        <Instances placements={spikes.naStalk}>
          <cylinderGeometry args={[0.004, 0.004, 0.06, 5]} />
          <EnvelopeMaterial
            clip={cut}
            color={VIRION_COLORS.neuraminidase}
            wedge
          />
        </Instances>
        <Instances placements={spikes.naHead}>
          <boxGeometry args={[0.034, 0.034, 0.034]} />
          <EnvelopeMaterial
            clip={cut}
            color={VIRION_COLORS.neuraminidase}
            wedge
          />
        </Instances>
        {Arr.map(SEGMENTS, (segment) => (
          <Ribonucleoprotein
            key={segment.id}
            length={segment.length}
            position={segment.position}
          />
        ))}
      </group>
    </group>
  );
}

/**
 * One ribonucleoprotein segment: RNA wrapped in nucleoprotein, folded back on
 * itself and twisted into a rod about 12 nm wide.
 */
function Ribonucleoprotein({
  length,
  position,
}: {
  readonly length: number;
  readonly position: readonly [number, number, number];
}) {
  const strands = useMemo(
    () =>
      Arr.map([0, Math.PI] as const, (phase) => ({
        curve: new CatmullRomCurve3(
          Arr.map(
            helixPath({ length, phase, radius: 0.014, turns: length * 14 }),
            (point) => new Vector3(...point)
          )
        ),
        phase,
      })),
    [length]
  );
  return (
    <group position={position}>
      {Arr.map(strands, ({ curve, phase }) => (
        <mesh castShadow key={phase}>
          <tubeGeometry args={[curve, 120, 0.011, 6, false]} />
          <meshPhysicalMaterial
            clearcoat={0.3}
            color={VIRION_COLORS.nucleocapsid}
            roughness={0.5}
          />
        </mesh>
      ))}
    </group>
  );
}
