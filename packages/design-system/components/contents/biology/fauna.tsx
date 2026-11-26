import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MIT_BIRD_FLIGHT_ASSET } from "@repo/design-system/components/contents/biology/assets";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { Schema } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { Object3D } from "three";
import {
  AnimationMixer,
  Box3,
  DoubleSide,
  Mesh,
  MeshPhysicalMaterial,
  Vector3,
} from "three";

const FaunaMaterialOverrideSchema = Schema.Struct({
  clearcoat: Schema.optional(Schema.Finite),
  color: Schema.String,
  opacity: Schema.optional(Schema.Finite),
  roughness: Schema.Finite,
  sheen: Schema.optional(Schema.Finite),
  sheenColor: Schema.optional(Schema.String),
  useVertexColors: Schema.optional(Schema.Boolean),
});

const PrepareFaunaOptionsSchema = Schema.Struct({
  groundBottom: Schema.optional(Schema.Boolean),
  materialOverride: Schema.optional(FaunaMaterialOverrideSchema),
  targetExtent: Schema.Finite,
});

type PrepareFaunaOptions = typeof PrepareFaunaOptionsSchema.Type;

/**
 * Clones a loaded open-source fauna GLB, normalizes its largest bounding extent
 * to `targetExtent`, centers X/Z at origin, optionally grounds its feet/base at
 * `y = 0`, and enables shadows while keeping its original PBR textures intact.
 */
export function prepareFaunaScene(
  source: Object3D,
  options: PrepareFaunaOptions
): Object3D {
  const clone = source.clone(true);
  clone.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(clone);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const largest = Math.max(size.x, size.y, size.z, 1e-6);
  const scale = options.targetExtent / largest;

  clone.scale.multiplyScalar(scale);
  clone.position.set(
    -center.x * scale,
    options.groundBottom ? -bounds.min.y * scale : -center.y * scale,
    -center.z * scale
  );

  const override = options.materialOverride;
  clone.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }
    child.castShadow = true;
    child.receiveShadow = true;
    if (override !== undefined) {
      const hasVertexColors =
        override.useVertexColors !== false &&
        child.geometry.getAttribute("color") !== undefined;
      const transparent =
        override.opacity !== undefined && override.opacity < 1;
      child.material = new MeshPhysicalMaterial({
        clearcoat: override.clearcoat ?? 0.16,
        clearcoatRoughness: 0.45,
        color: override.color,
        depthWrite: !transparent,
        opacity: override.opacity ?? 1,
        roughness: override.roughness,
        sheen: override.sheen ?? 0.3,
        sheenColor: override.sheenColor ?? override.color,
        sheenRoughness: 0.6,
        side: DoubleSide,
        transparent,
        vertexColors: hasVertexColors,
      });
    }
  });

  return clone;
}

/**
 * Animated morph-target soaring bird (`mit-bird-flight.glb`) supporting both
 * deterministic pose selection (upstroke vs downstroke) and continuous flight.
 */
export function AnimatedFlightBird({
  color,
  opacity = 1,
  playing,
  poseTime,
  sheenColor,
  speed = 0.85,
  targetExtent,
}: {
  readonly color: string;
  readonly opacity?: number;
  readonly playing: boolean;
  readonly poseTime: number;
  readonly sheenColor?: string;
  readonly speed?: number;
  readonly targetExtent: number;
}) {
  const { animations, scene } = useGLTF(MIT_BIRD_FLIGHT_ASSET.path);
  const bird = useMemo(
    () =>
      prepareFaunaScene(scene, {
        groundBottom: false,
        materialOverride: {
          clearcoat: 0.14,
          color,
          opacity,
          roughness: 0.46,
          sheen: 0.32,
          sheenColor: sheenColor ?? color,
          useVertexColors: false,
        },
        targetExtent,
      }),
    [color, opacity, scene, sheenColor, targetExtent]
  );

  const mixer = useMemo(() => {
    const m = new AnimationMixer(bird);
    const clip = animations[0];
    if (clip !== undefined) {
      m.clipAction(clip).play();
    }
    return m;
  }, [animations, bird]);

  const timeRef = useRef(poseTime);

  useEffect(() => {
    timeRef.current = poseTime;
    mixer.setTime(poseTime);
  }, [mixer, poseTime]);

  useEffect(
    () => () => {
      mixer.stopAllAction();
    },
    [mixer]
  );

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    timeRef.current += simulationStep(delta) * speed;
    mixer.setTime(timeRef.current);
  });

  return <primitive object={bird} />;
}

useGLTF.preload(MIT_BIRD_FLIGHT_ASSET.path);
