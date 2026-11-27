import { assert, describe, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { inspectMediaFiles, inspectMediaSource } from "#scripts/check/media";
import { parseSources } from "#scripts/check/source";

const LAB = "packages/design-system/components/contents/biology/taxon/lab.tsx";
const PLANET =
  "packages/design-system/components/contents/biology/climate/observation.tsx";
const ASSETS = "packages/design-system/components/contents/biology/assets.ts";
const MEDIA_RULE =
  "raw 2D raster photos, image planes, and raster texture loaders are banned in 3D and p5 visuals. Build real 3D geometry or load an open-source .glb/.gltf model instead (web photos are reference only).";

/** Inspects one module with the 3D/p5 raw-media policy alone. */
function inspect(sourceText: string, file = LAB) {
  return Effect.scoped(
    Effect.map(parseSources([{ file, sourceText }]), ({ modules }) =>
      Arr.flatMap(modules, (parsed) =>
        inspectMediaSource(parsed.file, parsed.sourceFile)
      )
    )
  );
}

describe("3D and p5 raw-media policy", () => {
  it.effect(
    "rejects <img>, raster loaders, data URIs, and raster photo literals in content visuals",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`export function Bad({ p }: { p: { loadImage: (s: string) => void } }) {
  const a = useTexture("/textures/biology/specimens/tapir.webp");
  const b = new TextureLoader();
  const c = new THREE.ImageLoader();
  const d = new Image();
  const e = p.loadImage(\`/photos/\${"bird"}.png\`);
  const f = loadImage("data:image/jpeg;base64,AAA");
  const g = useTexture.preload("/textures/hornbill.jpg?v=1");
  return <img alt="tapir" src="/img/tapir.jpeg" />;
}`),
          [
            `${LAB}:2: ${MEDIA_RULE}`,
            `${LAB}:2: ${MEDIA_RULE}`,
            `${LAB}:3: ${MEDIA_RULE}`,
            `${LAB}:4: ${MEDIA_RULE}`,
            `${LAB}:5: ${MEDIA_RULE}`,
            `${LAB}:6: ${MEDIA_RULE}`,
            `${LAB}:6: ${MEDIA_RULE}`,
            `${LAB}:7: ${MEDIA_RULE}`,
            `${LAB}:7: ${MEDIA_RULE}`,
            `${LAB}:8: ${MEDIA_RULE}`,
            `${LAB}:8: ${MEDIA_RULE}`,
            `${LAB}:9: <img>: ${MEDIA_RULE}`,
            `${LAB}:9: ${MEDIA_RULE}`,
          ]
        );
      })
  );

  it.effect(
    "allows .glb/.gltf models, procedural canvases, the allowlisted Blue Marble Earth map, and non-content/test files",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(`export function Clean() {
  const model = useGLTF("/models/biology/cc0-deer.glb");
  const tex = new CanvasTexture(document.createElement("canvas"));
  const helper = getHelper()();
  const custom = new CustomFactory()();
  return <group>{model.scene}{tex.uuid}{helper}{custom}</group>;
}`),
          []
        );
        assert.deepStrictEqual(
          yield* inspect(
            `export function Planet() {
  const tex = useTexture(BLUE_MARBLE_EARTH_TEXTURE_ASSET.path);
  return <mesh>{tex}</mesh>;
}
useTexture.preload(BLUE_MARBLE_EARTH_TEXTURE_ASSET.path);`,
            PLANET
          ),
          []
        );
        assert.deepStrictEqual(
          yield* inspect(
            `export const BLUE_MARBLE_EARTH_TEXTURE_ASSET = {
  path: "/textures/biology/blue-marble-january-2048.jpg",
  sourceImageUrl: "https://assets.science.nasa.gov/world.topo.bathy.200401.3x5400x2700.jpg",
};`,
            ASSETS
          ),
          []
        );
        assert.deepStrictEqual(
          yield* inspect(
            `export const photo = "/textures/tapir.webp";`,
            "packages/design-system/components/contents/biology/taxon/lab.test.ts"
          ),
          []
        );
        assert.deepStrictEqual(
          yield* inspect(
            `export const photo = <img src="/logo.png" />;`,
            "packages/design-system/components/visual/example.tsx"
          ),
          []
        );
      })
  );

  it.effect(
    "rejects non-Earth useTexture calls even inside an allowlisted Earth globe module",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* inspect(
            `export function Sneaky() {
  useTexture();
  return useTexture(OTHER_ASSET.path);
}`,
            PLANET
          ),
          [`${PLANET}:2: ${MEDIA_RULE}`, `${PLANET}:3: ${MEDIA_RULE}`]
        );
      })
  );

  it("rejects new raster image files in public textures or models while allowing existing GLB models and allowlisted files", () => {
    assert.deepStrictEqual(
      inspectMediaFiles([
        "apps/www/public/textures/biology/blue-marble-january-2048.jpg",
        "apps/www/public/models/physics/kinematics/water/waternormals.jpg",
        "apps/www/public/models/biology/cc0-deer.glb",
        "apps/www/public/images/og.png",
        "apps/www/public/textures/biology/specimens/tapir.webp",
        "apps/www/public/models/biology/hornbill.jpg",
      ]),
      [
        `apps/www/public/textures/biology/specimens/tapir.webp: ${MEDIA_RULE}`,
        `apps/www/public/models/biology/hornbill.jpg: ${MEDIA_RULE}`,
      ]
    );
  });
});
