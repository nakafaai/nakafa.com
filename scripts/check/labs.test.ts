import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectLabSource, LAB_PAGE } from "#scripts/check/labs";
import { parseSources } from "#scripts/check/source";

const FOLDER = "packages/design-system/components/contents/physics/lens";
const LAB = `${FOLDER}/scene.tsx`;
const SHAPE =
  "components/three/form (<Sweep>, <Turn>) or the kit it belongs to";
const MATTER = 'components/three/matter (<Matter of="brass" />)';
const KIT = "the kit it belongs to in components/three, drawn procedurally";

/** Inspects one module with the lab rule alone. */
function inspect(sourceText: string, file = LAB) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectLabSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

/** The finding for one part drawn in the lab, at a line, with the engine folder that owns it. */
function drawn(line: number, what: string, owner: string) {
  return {
    folder: FOLDER,
    message: `${LAB}:${line}: ${what} is drawn in a lab: build the part in ${owner} and compose it here (${LAB_PAGE}).`,
  };
}

describe("lab engine-only rule", () => {
  it.effect(
    "rejects bare geometries and materials, as elements and as classes, raw objects and loaders",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import * as THREE from "three";
import { BoxGeometry, ShaderMaterial } from "three";
export function Lens({ model }: { model: THREE.Object3D }) {
  const shape = new BoxGeometry(1, 1, 1);
  const glass = new THREE.MeshPhysicalMaterial();
  const shader = new ShaderMaterial({});
  const loader = new GLTFLoader();
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="red" />
      <shaderMaterial />
      <primitive object={model} />
      {shape.uuid}{glass.uuid}{shader.uuid}{loader.path}
    </mesh>
  );
}`),
          [
            drawn(4, "new BoxGeometry", SHAPE),
            drawn(5, "new MeshPhysicalMaterial", MATTER),
            drawn(6, "new ShaderMaterial", MATTER),
            drawn(7, "new GLTFLoader", KIT),
            drawn(10, "<boxGeometry>", SHAPE),
            drawn(11, "<meshStandardMaterial>", MATTER),
            drawn(12, "<shaderMaterial>", MATTER),
            drawn(13, "<primitive>", KIT),
          ]
        );
      })
  );

  it.effect(
    "rejects drei shapes, drei materials, and the drei and fiber loaders of models and textures",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import { Billboard, Line, PointMaterial, RoundedBox as Slab, useGLTF } from "@react-three/drei";
import { useFrame, useLoader } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
export function Lens() {
  return <Billboard><Slab /><Line points={[]} /><PointMaterial />{useGLTF}{useLoader}{useTexture}{useFrame}</Billboard>;
}`),
          [
            drawn(1, "Line from @react-three/drei", SHAPE),
            drawn(1, "PointMaterial from @react-three/drei", MATTER),
            drawn(1, "RoundedBox from @react-three/drei", SHAPE),
            drawn(1, "useGLTF from @react-three/drei", KIT),
            drawn(2, "useLoader from @react-three/fiber", KIT),
            drawn(3, "useTexture from @react-three/drei", KIT),
          ]
        );
      })
  );

  it.effect(
    "allows engine parts in placement objects, type imports, other classes, and modules outside the labs",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`import type { MeshPhysicalMaterial } from "three";
import type { RoundedBox } from "@react-three/drei";
import { type Line, Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as Drei from "@react-three/drei";
import Fiber from "@react-three/fiber";
import "@react-three/drei";
import { Turn } from "@repo/design-system/components/three/form/part";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { Color, Vector3 } from "three";
export function Lens({ glass }: { box: RoundedBox; glass: MeshPhysicalMaterial; line: Line }) {
  const tint = new Color("#fff");
  const at = new Vector3();
  const made = new (factory())();
  return (
    <group position={at}>
      <mesh castShadow>
        <Turn profile={[]} />
        <Matter of="brass" />
      </mesh>
      <points /><line /><Drei.Billboard /><Billboard /><svg:rect />
      {tint.r}{made}{glass.uuid}{useFrame}{Fiber}
    </group>
  );
}`),
          []
        );
        const bare = "export const Bare = () => <boxGeometry />;";
        assert.deepStrictEqual(
          yield* inspect(bare, `${FOLDER}/scene.test.tsx`),
          []
        );
        assert.deepStrictEqual(
          yield* inspect(
            bare,
            "packages/design-system/components/three/form/part.tsx"
          ),
          []
        );
      })
  );
});
