import { useFrame } from "@react-three/fiber";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import type { Growth } from "@repo/design-system/components/three/stage/blades";
import {
  BLADE_HEIGHT,
  BLADES,
  bladeMesh,
  focusOn,
  layBlades,
  scatterBlades,
} from "@repo/design-system/components/three/stage/blades";
import { useStage } from "@repo/design-system/components/three/stage/context";
import { paintCover } from "@repo/design-system/components/three/stage/cover";
import { FLAT_REACHES } from "@repo/design-system/components/three/stage/relief";
import type { ReactNode } from "react";
import { createContext, use, useEffect, useMemo, useRef } from "react";
import type { Group, Material, Object3D } from "three";
import {
  BufferAttribute,
  Color,
  DataTexture,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  RepeatWrapping,
  RGBAFormat,
  Vector2,
  WebGLRenderTarget,
} from "three";

/** How many pixels a side the painted cover of a lawn has. */
const COVER_PIXELS = 256;

/**
 * How far above the ground the map of what presses the grass starts: over
 * the ground itself and the soft verge of a road, which grass grows through,
 * and under the road's own surface.
 */
const CLEAR = 0.006;

/** The lawn the ground under it shares its cover with, when the ground is a lawn. */
const LawnContext = createContext<Growth | null>(null);

/** Reads the lawn that grows on the surrounding ground, when one does. */
export function useLawn() {
  return use(LawnContext);
}

/**
 * What one lawn is drawn from, made once and freed with the lawn: its
 * painted cover, the map of what lies on the ground and presses the grass
 * down with the camera that draws it from below, the mesh of its blades,
 * and the values its ground and its blades both read.
 */
function useGrowth() {
  const { reach, tier } = useStage();
  const growth = useMemo(() => {
    const { count, pressed, radius, segments, width } = BLADES[tier];
    const cover = new DataTexture(
      paintCover(COVER_PIXELS),
      COVER_PIXELS,
      COVER_PIXELS,
      RGBAFormat
    );
    cover.wrapS = RepeatWrapping;
    cover.wrapT = RepeatWrapping;
    cover.magFilter = LinearFilter;
    cover.minFilter = LinearMipmapLinearFilter;
    cover.generateMipmaps = true;
    cover.needsUpdate = true;
    const under = new WebGLRenderTarget(pressed, pressed);
    const below = new OrthographicCamera(
      -radius,
      radius,
      radius,
      -radius,
      0,
      1.5 * BLADE_HEIGHT
    );
    below.up.set(0, 0, 1);
    below.lookAt(0, 1, 0);
    const mesh = bladeMesh(segments);
    const scattered = scatterBlades(count, 2 * radius, COVER_PIXELS);
    const blades = new InstancedBufferGeometry();
    blades.setAttribute(
      "position",
      new BufferAttribute(new Float32Array((mesh.shape.length / 2) * 3), 3)
    );
    blades.setAttribute(
      "normal",
      new BufferAttribute(new Float32Array((mesh.shape.length / 2) * 3), 3)
    );
    blades.setAttribute("aShape", new BufferAttribute(mesh.shape, 2));
    blades.setAttribute(
      "aRoot",
      new InstancedBufferAttribute(scattered.roots, 4)
    );
    blades.setAttribute(
      "aTrait",
      new InstancedBufferAttribute(scattered.traits, 4)
    );
    blades.setIndex(mesh.indices);
    blades.instanceCount = count;
    const uniforms: Growth = {
      uBlade: { value: BLADE_HEIGHT },
      uCover: { value: cover },
      uFlat: { value: FLAT_REACHES * reach },
      uFocus: { value: new Vector2() },
      uPixel: { value: 0 },
      uPressed: { value: under.texture },
      uRadius: { value: radius },
      uTime: { value: 0 },
      uWidth: { value: width },
    };
    return {
      below,
      blades,
      cover,
      grid: (2 * radius) / pressed,
      mask: new MeshBasicMaterial({ fog: false, side: DoubleSide }),
      radius,
      under,
      uniforms,
    };
  }, [reach, tier]);

  useEffect(
    () => () => {
      growth.blades.dispose();
      growth.cover.dispose();
      growth.mask.dispose();
      growth.under.dispose();
    },
    [growth]
  );

  return growth;
}

/** Lays the blades' program on the material it is given. */
function useBlades(growth: Growth) {
  return useMemo(
    () => (material: Material | null) => {
      if (material === null) {
        return;
      }
      material.onBeforeCompile = (program) => {
        layBlades(program, growth);
      };
      material.customProgramCacheKey = () => "lawn-blades";
      material.needsUpdate = true;
    },
    [growth]
  );
}

/** The clear colour the renderer had before the lawn drew what presses its grass. */
const KEPT = new Color();

/** What the lawn hid while it drew what presses its grass, kept here so nothing is allocated. */
const HIDDEN: Object3D[] = [];

/**
 * Hides a thing that is drawn without culling: a sky, a backdrop or the
 * blades themselves, whose mesh is not where it is drawn, so it has no
 * place of its own on the ground and presses no grass.
 */
function hideUnplaced(object: Object3D) {
  if (object.frustumCulled) {
    return;
  }
  object.visible = false;
  HIDDEN.push(object);
}

/** The camera's place and the way it looks, written here each frame so nothing is allocated. */
const EYE: [number, number, number] = [0, 0, 0];
const GAZE: [number, number, number] = [0, 0, -1];

/**
 * A lawn on the stage's ground: its children are the ground it grows on,
 * which takes the lawn's cover, and over it stand the blades, thickest
 * where the camera looks. Before each frame the lawn finds that place and
 * draws, from below, whatever lies within a blade's height of the ground
 * around it, with the ground itself left out: a slab, a road, a wheel or a
 * ball presses the grass flat under it, so no blade passes through
 * anything. The wind moves the blades only on a stage that animates.
 */
export function Lawn({ children }: { readonly children: ReactNode }) {
  const { animated, floor = 0 } = useStage();
  const growth = useGrowth();
  const lay = useBlades(growth.uniforms);
  const land = useRef<Group>(null);

  useFrame(({ camera, clock, gl, scene, size, viewport }) => {
    const { below, grid, mask, radius, under, uniforms } = growth;
    const view = camera.matrixWorld.elements;
    EYE[0] = Number(view[12]);
    EYE[1] = Number(view[13]);
    EYE[2] = Number(view[14]);
    GAZE[0] = -Number(view[8]);
    GAZE[1] = -Number(view[9]);
    GAZE[2] = -Number(view[10]);
    const halfFov =
      camera instanceof PerspectiveCamera
        ? (camera.fov * Math.PI) / 360
        : Math.PI / 8;
    const focus = focusOn(
      uniforms.uFocus.value,
      EYE,
      GAZE,
      halfFov,
      floor,
      radius,
      grid
    );
    uniforms.uPixel.value =
      (2 * Math.tan(halfFov)) / (size.height * viewport.dpr);
    uniforms.uTime.value = animated ? clock.elapsedTime : 0;
    if (land.current === null) {
      return;
    }
    const alpha = gl.getClearAlpha();
    const auto = gl.autoClear;
    const background = scene.background;
    const override = scene.overrideMaterial;
    const shadows = gl.shadowMap.autoUpdate;
    const target = gl.getRenderTarget();
    gl.getClearColor(KEPT);
    below.position.set(focus.x, floor + CLEAR, focus.y);
    below.updateMatrixWorld();
    land.current.visible = false;
    scene.traverseVisible(hideUnplaced);
    scene.background = null;
    scene.overrideMaterial = mask;
    gl.shadowMap.autoUpdate = false;
    gl.autoClear = true;
    gl.setClearColor(0, 1);
    gl.setRenderTarget(under);
    gl.render(scene, below);
    gl.setRenderTarget(target);
    gl.setClearColor(KEPT, alpha);
    gl.autoClear = auto;
    gl.shadowMap.autoUpdate = shadows;
    scene.overrideMaterial = override;
    scene.background = background;
    for (const object of HIDDEN) {
      object.visible = true;
    }
    HIDDEN.length = 0;
    land.current.visible = true;
  });

  return (
    <LawnContext value={growth.uniforms}>
      <group ref={land}>{children}</group>
      <CameraBounds exclude>
        <mesh
          frustumCulled={false}
          geometry={growth.blades}
          position={[0, floor, 0]}
          receiveShadow
        >
          <meshStandardMaterial ref={lay} roughness={0.62} side={DoubleSide} />
        </mesh>
      </CameraBounds>
    </LawnContext>
  );
}
