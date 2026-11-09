import { useFrame } from "@react-three/fiber";
import { Array as Arr, Option } from "effect";
import { useMemo } from "react";
import {
  BufferAttribute,
  DynamicDrawUsage,
  GLSL3,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  ShaderMaterial,
  Vector2,
} from "three";
import { useSkyStore } from "@/components/island/sky";
import {
  BUDS,
  DUCK,
  FIREFLY,
  FISH,
  FLOWERS,
  NINA_PEEK,
  SMOKE,
} from "@/lib/island/animals";
import {
  type chimneysOf,
  type firefliesOf,
  flyAt,
  PUFFS_PER_CHIMNEY,
  puffAt,
} from "@/lib/island/life";
import { swimAt } from "@/lib/island/motion";
import type { floraOf, wildlifeOf } from "@/lib/island/pieces";
import { gradeOf } from "@/lib/island/sky";
import { packAtlas } from "@/lib/island/sprite";
import { pixelTexture } from "@/lib/island/texture";

/** Three declares the matrices and `position`; the rest are the sprite's own. */
const VERTEX = /* glsl */ `
uniform vec2 resolution;
in vec3 offset;
in vec4 frame;
in vec3 heading;
out vec2 vTexel;
void main() {
  mat4 project = projectionMatrix * viewMatrix * modelMatrix;
  vec4 base = project * vec4(offset, 1.0);
  vec4 ahead = project * vec4(offset + heading, 1.0);
  bool flip = ahead.x / ahead.w < base.x / base.w;
  vec2 pixel = floor((base.xy / base.w * 0.5 + 0.5) * resolution);
  vec2 corner = vec2(
    pixel.x - floor(frame.z / 2.0) + position.x * frame.z,
    pixel.y + position.y * frame.w
  );
  gl_Position = vec4((corner / resolution * 2.0 - 1.0) * base.w, base.z - 0.002 * base.w, base.w);
  float across = flip ? 1.0 - position.x : position.x;
  vTexel = vec2(frame.x + across * frame.z, frame.y + (1.0 - position.y) * frame.w);
}
`;

/**
 * One atlas texel to one art pixel. Clear texels are dropped. A sprite pixel
 * keeps its palette index in alpha like a voxel's, and marks itself with a
 * normal of alpha zero, so the outline pass leaves it, since a sprite draws its
 * own outline.
 */
const FRAGMENT = /* glsl */ `
uniform sampler2D atlas;
in vec2 vTexel;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outNormal;
void main() {
  vec4 texel = texelFetch(atlas, ivec2(floor(vTexel)), 0);
  if (texel.a < 0.5 / 255.0) discard;
  outColor = vec4(texel.rgb, texel.a - 1.0 / 255.0);
  outNormal = vec4(0.5, 0.5, 1.0, 0.0);
}
`;

/** The animals' sprites, packed once into one atlas. */
const SPRITES = {
  buds: BUDS,
  duck: DUCK,
  firefly: FIREFLY,
  fish: FISH,
  flowers: FLOWERS,
  nina: NINA_PEEK,
  smoke: SMOKE,
};

/** The atlas texture, the frames' places in it, and the quad every sprite draws on. */
function useAtlas(count: number) {
  return useMemo(() => {
    const atlas = packAtlas(SPRITES);
    const geometry = new InstancedBufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(
        new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
        3
      )
    );
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const attribute = (size: number) =>
      new InstancedBufferAttribute(
        new Float32Array(count * size),
        size
      ).setUsage(DynamicDrawUsage);
    geometry.setAttribute("offset", attribute(3));
    geometry.setAttribute("frame", attribute(4));
    geometry.setAttribute("heading", attribute(3));
    geometry.instanceCount = count;
    const material = new ShaderMaterial({
      fragmentShader: FRAGMENT,
      glslVersion: GLSL3,
      uniforms: {
        atlas: { value: pixelTexture(atlas.pixels, atlas.width, atlas.height) },
        resolution: { value: new Vector2(1, 1) },
      },
      vertexShader: VERTEX,
    });
    return { frames: atlas.frames, geometry, material };
  }, [count]);
}

/**
 * The island's life as pixel sprites standing in the 3D world (ADR 0042, D16,
 * D18, D28): each frame moves the animals along their swims, raises smoke from
 * every chimney, sends fireflies round the plants on a fine night, and picks
 * each sprite's animation frame from the clock. A hidden sprite draws an empty
 * frame.
 */
export function Wildlife({
  animals,
  chimneys,
  flies,
  flora,
}: {
  animals: ReturnType<typeof wildlifeOf>;
  chimneys: ReturnType<typeof chimneysOf>;
  flies: ReturnType<typeof firefliesOf>;
  flora: ReturnType<typeof floraOf>;
}) {
  const puffs = chimneys.length * PUFFS_PER_CHIMNEY;
  const { frames, geometry, material } = useAtlas(
    animals.length + flora.length + flies.length + puffs
  );
  const sky = useSkyStore();
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const { phase, weather } = sky.getState();
    const night = gradeOf(phase, weather).flies;
    material.uniforms.resolution.value.set(
      state.gl.domElement.width,
      state.gl.domElement.height
    );
    const offset = geometry.getAttribute("offset");
    const frame = geometry.getAttribute("frame");
    const heading = geometry.getAttribute("heading");
    Arr.forEach(animals, (animal, index) => {
      const swim = swimAt(animal, time);
      const sprite = SPRITES[animal.animal];
      const step = Math.floor(time * sprite.fps) % sprite.frames.length;
      const at = Arr.get(frames[animal.animal], step).pipe(
        Option.filter(() => swim.visible),
        Option.getOrUndefined
      );
      offset.setXYZ(index, swim.x, swim.y, swim.z);
      heading.setXYZ(index, swim.dx, 0, swim.dz);
      frame.setXYZW(
        index,
        at?.x ?? 0,
        at?.y ?? 0,
        at?.width ?? 0,
        at?.height ?? 0
      );
    });
    Arr.forEach(flora, (plant, at) => {
      const index = animals.length + at;
      const sprite = SPRITES[plant.sprite];
      const step = Math.floor(time * sprite.fps + at) % sprite.frames.length;
      const placed = Arr.get(frames[plant.sprite], step).pipe(
        Option.getOrUndefined
      );
      offset.setXYZ(index, plant.x, plant.y, plant.z);
      heading.setXYZ(index, 1, 0, 0);
      frame.setXYZW(
        index,
        placed?.x ?? 0,
        placed?.y ?? 0,
        placed?.width ?? 0,
        placed?.height ?? 0
      );
    });
    const place = (
      index: number,
      at: Pick<ReturnType<typeof puffAt>, "x" | "y" | "z">,
      shown: Option.Option<(typeof frames)["smoke"][number]>
    ) => {
      const placed = Option.getOrUndefined(shown);
      offset.setXYZ(index, at.x, at.y, at.z);
      heading.setXYZ(index, 1, 0, 0);
      frame.setXYZW(
        index,
        placed?.x ?? 0,
        placed?.y ?? 0,
        placed?.width ?? 0,
        placed?.height ?? 0
      );
    };
    const fliesFrom = animals.length + flora.length;
    Arr.forEach(flies, (fly, at) => {
      const moment = flyAt(fly, time);
      place(
        fliesFrom + at,
        moment,
        Arr.get(frames.firefly, moment.glowing ? 0 : 1).pipe(
          Option.filter(() => night)
        )
      );
    });
    const puffsFrom = fliesFrom + flies.length;
    Arr.forEach(chimneys, (chimney, at) => {
      Arr.forEach(Arr.range(0, PUFFS_PER_CHIMNEY - 1), (puff) => {
        const moment = puffAt(chimney, puff, time);
        place(
          puffsFrom + at * PUFFS_PER_CHIMNEY + puff,
          moment,
          Arr.get(frames.smoke, moment.frame)
        );
      });
    });
    offset.needsUpdate = true;
    frame.needsUpdate = true;
    heading.needsUpdate = true;
  });
  return <mesh frustumCulled={false} geometry={geometry} material={material} />;
}
