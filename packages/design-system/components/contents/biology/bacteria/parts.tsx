import {
  cytoplasmPoints,
  nucleoidPath,
  rodSurfaceSpots,
} from "@repo/design-system/components/contents/biology/bacteria/cell";
import {
  CapsuleHalo,
  Fimbriae,
  Flagellum,
  useRodGeometry,
} from "@repo/design-system/components/contents/biology/bacteria/envelope";
import {
  EnvelopeMaterial,
  useBumpySphere,
  useClipping,
} from "@repo/design-system/components/contents/biology/surface";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr } from "effect";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import {
  CatmullRomCurve3,
  type InstancedMesh,
  Matrix4,
  Plane,
  TubeGeometry,
  Vector3,
} from "three";

/** A bacillus at scene scale: about 0.6 wide and 1.6 long, the proportions of Escherichia coli (0.8 by 2 µm). */
const BACILLUS = { length: 1, radius: 0.3 } as const;

/** The plane that opens a bacillus to show its cytoplasm: everything in front of z = 0 is cut away. */
const CUTAWAY = [new Plane(new Vector3(0, 0, -1), 0)] as const;

/** Where the peritrichous flagella leave the rear half of the cell, and the way each trails. */
const FLAGELLA = Arr.filter(
  rodSurfaceSpots(14, BACILLUS.radius, BACILLUS.length),
  ({ position }) => position[0] < -0.05
);

/**
 * A rod-shaped bacterium such as Escherichia coli: a bumpy, waxy envelope in
 * a faint slime capsule, short fimbriae all over, and flagella trailing as
 * left-handed helices. Opened, a cutaway shows the inner membrane, the
 * tangled nucleoid with no nuclear envelope, a plasmid, and the cytoplasm
 * crowded with ribosomes.
 */
export function BacillusBacteriumModel({
  scale = 1,
  showFlagellum = true,
  showInterior = true,
  showPili = true,
}: {
  scale?: number;
  showFlagellum?: boolean;
  showInterior?: boolean;
  showPili?: boolean;
}) {
  return (
    <group scale={scale}>
      {showInterior ? (
        <OpenBacillus>
          <Nucleoid />
          <Ribosomes />
        </OpenBacillus>
      ) : (
        <ClosedBacillus />
      )}
      {showPili ? (
        <Fimbriae
          count={140}
          length={BACILLUS.length}
          radius={BACILLUS.radius}
          reach={0.12}
        />
      ) : null}
      {showFlagellum
        ? Arr.map(FLAGELLA, ({ normal, position }, index) => (
            <Flagellum
              direction={[-1.6, normal[1] * 0.5, normal[2] * 0.5]}
              key={Arr.join(Arr.map(position, String), ",")}
              length={1.5}
              origin={position}
              phase={index * 1.3}
            />
          ))
        : null}
    </group>
  );
}

/** A whole bacillus seen from outside: its bumpy envelope in a faint slime capsule. */
function ClosedBacillus() {
  const body = useRodGeometry(BACILLUS.radius, BACILLUS.length, 1);
  return (
    <group>
      <mesh castShadow geometry={body} receiveShadow>
        <EnvelopeMaterial clip={undefined} color={MATERIAL.bacterialEnvelope} />
      </mesh>
      <CapsuleHalo geometry={body} scale={[1.07, 1.16, 1.16]} />
    </group>
  );
}

/**
 * A bacillus with the front half of its envelope cut away, the plasma
 * membrane lining the wall, and `children` inside it: the nucleoid and
 * ribosomes of a resting cell, or a phage's work in an infected one.
 */
export function OpenBacillus({ children }: { readonly children: ReactNode }) {
  useClipping();
  const body = useRodGeometry(BACILLUS.radius, BACILLUS.length, 1);
  const membrane = useRodGeometry(BACILLUS.radius * 0.9, BACILLUS.length, 4);
  return (
    <group>
      <mesh castShadow geometry={body} receiveShadow>
        <EnvelopeMaterial clip={CUTAWAY} color={MATERIAL.bacterialEnvelope} />
      </mesh>
      <mesh geometry={membrane}>
        <EnvelopeMaterial clip={CUTAWAY} color={MATERIAL.plasmaMembrane} />
      </mesh>
      {children}
    </group>
  );
}

/**
 * The nucleoid as a tangled strand in the middle of the cell, with no
 * nuclear envelope, beside a small circular plasmid.
 */
function Nucleoid() {
  const nucleoid = useMemo(
    () =>
      new CatmullRomCurve3(
        Arr.map(
          nucleoidPath(260, 0.15, 0.7, 2),
          (point) => new Vector3(...point)
        )
      ),
    []
  );
  const plasmid = useMemo(
    () =>
      new CatmullRomCurve3(
        Arr.map(Arr.range(0, 23), (step) => {
          const angle = (step / 24) * Math.PI * 2;
          return new Vector3(
            Math.cos(angle) * 0.06,
            Math.sin(angle) * 0.06,
            Math.sin(angle * 3) * 0.012
          );
        }),
        true
      ),
    []
  );
  return (
    <group>
      <mesh>
        <tubeGeometry args={[nucleoid, 900, 0.008, 5, false]} />
        <meshStandardMaterial color={MATERIAL.nucleoid} roughness={0.45} />
      </mesh>
      <mesh position={[0.36, -0.12, -0.08]} rotation={[0.4, 0.3, 0]}>
        <tubeGeometry args={[plasmid, 64, 0.008, 5, true]} />
        <meshStandardMaterial color={MATERIAL.nucleoid} roughness={0.45} />
      </mesh>
    </group>
  );
}

/** Ribosomes in their hundreds through the back half of the cytoplasm, one instanced mesh of small granules. */
export function Ribosomes() {
  const mesh = useRef<InstancedMesh>(null);
  const points = useMemo(
    () =>
      Arr.filter(
        cytoplasmPoints(700, BACILLUS.radius * 0.9, BACILLUS.length, 7),
        (point) => point[2] < 0
      ),
    []
  );
  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) {
      return;
    }
    const matrix = new Matrix4();
    Arr.forEach(points, (point, index) => {
      target.setMatrixAt(index, matrix.makeTranslation(...point));
    });
    target.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh args={[undefined, undefined, points.length]} ref={mesh}>
      <icosahedronGeometry args={[0.011, 0]} />
      <meshStandardMaterial color={MATERIAL.ribosome} roughness={0.55} />
    </instancedMesh>
  );
}

/**
 * Cocci as Staphylococcus aureus grows them: golden cells about 1 µm across
 * in a grape-like cluster, because each division plane is perpendicular to
 * the last, the young pairs still joined at a pale septum band.
 */
export function CoccusClusterModel({ scale = 1 }: { scale?: number }) {
  const cell = useBumpySphere(0.16, 3, 0.03);
  const cells = [
    [-0.2, 0.1, 0.02],
    [0.08, 0.2, -0.04],
    [0.26, 0.02, 0.06],
    [-0.06, -0.1, 0.12],
    [0.16, -0.22, -0.02],
    [-0.28, -0.16, -0.08],
    [0.02, 0.02, -0.22],
  ] as const;
  return (
    <group scale={scale}>
      {Arr.map(cells, (position, index) => (
        <group
          key={Arr.join(Arr.map(position, String), ",")}
          position={position}
          rotation={[index, index * 0.7, 0]}
        >
          <mesh castShadow geometry={cell} receiveShadow scale={[1, 0.94, 1]}>
            <EnvelopeMaterial
              clip={undefined}
              color={MATERIAL.staphylococcus}
            />
          </mesh>
          {index % 2 === 0 ? (
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.152, 0.008, 8, 48]} />
              <meshStandardMaterial color={MATERIAL.septum} roughness={0.6} />
            </mesh>
          ) : null}
        </group>
      ))}
    </group>
  );
}

/**
 * A spirillum: a rigid, helical cell body about three turns long, its surface
 * bumped like any envelope, with a tuft of flagella at each pole.
 */
export function SpirillumBacteriumModel({ scale = 1 }: { scale?: number }) {
  const turns = 2.6;
  const length = 1.3;
  const path = useMemo(
    () =>
      new CatmullRomCurve3(
        Arr.map(Arr.range(0, 80), (step) => {
          const t = step / 80;
          const angle = t * turns * Math.PI * 2;
          return new Vector3(
            -length / 2 + t * length,
            Math.cos(angle) * 0.13,
            Math.sin(angle) * 0.13
          );
        })
      ),
    []
  );
  const body = useMemo(
    () => new TubeGeometry(path, 240, 0.065, 18, false),
    [path]
  );
  useEffect(() => () => body.dispose(), [body]);
  const ends = [
    {
      direction: [-1, 0.3, 0] as const,
      origin: path.getPointAt(0).toArray(),
      pole: 0,
    },
    {
      direction: [1, -0.3, 0] as const,
      origin: path.getPointAt(1).toArray(),
      pole: 1,
    },
  ];
  return (
    <group scale={scale}>
      <mesh castShadow geometry={body} receiveShadow>
        <EnvelopeMaterial clip={undefined} color={MATERIAL.bacterialEnvelope} />
      </mesh>
      {Arr.map([0, 1] as const, (end) => (
        <mesh key={end} position={path.getPointAt(end)}>
          <sphereGeometry args={[0.065, 18, 14]} />
          <EnvelopeMaterial
            clip={undefined}
            color={MATERIAL.bacterialEnvelope}
          />
        </mesh>
      ))}
      {Arr.flatMap(ends, ({ direction, origin, pole }) =>
        Arr.map([-1, 0, 1] as const, (spread) => (
          <Flagellum
            direction={[
              direction[0],
              direction[1] + spread * 0.35,
              spread * 0.3,
            ]}
            key={`${pole}${spread}`}
            length={0.9}
            origin={[origin[0] ?? 0, origin[1] ?? 0, origin[2] ?? 0]}
            phase={spread * 2 + pole}
          />
        ))
      )}
    </group>
  );
}
