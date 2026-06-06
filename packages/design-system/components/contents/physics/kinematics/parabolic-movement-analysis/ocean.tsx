"use client";

import { useFrame, useLoader } from "@react-three/fiber";
import {
  PROJECTILE_SCENE,
  type ProjectileMotionState,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/data";
import { getColor } from "@repo/design-system/lib/color";
import { useEffect, useMemo, useRef } from "react";
import {
  DoubleSide,
  type Mesh,
  PlaneGeometry,
  RepeatWrapping,
  TextureLoader,
  Vector3,
} from "three";
import { Water } from "three/examples/jsm/objects/Water.js";

const WATER_NORMALS_PATH = "/models/physics/kinematics/water/waternormals.jpg";

const OCEAN_COLORS = {
  particle: getColor("SKY", 400),
  sun: getColor("WHITE"),
  water: getColor("TEAL", 700),
} as const;

const WIND_PARTICLE_COUNT = 36;
const OCEAN_SIDE_MARGIN = 120;
const OCEAN_WIDTH = 180;
const WIND_PARTICLES = Array.from(
  { length: WIND_PARTICLE_COUNT },
  (_, index) => {
    const progress = index / (WIND_PARTICLE_COUNT - 1);

    return {
      id: `wind-${index}`,
      offset: (index * 0.137) % 1,
      radius: 0.012 + (index % 4) * 0.006,
      speed: 0.035 + (index % 6) * 0.009,
      y: 0.42 + Math.sin(index * 1.7) * 0.38,
      z: Math.sin(index * 1.19) * 6.8,
      progress,
    };
  }
);

export function Ocean({ motion }: { motion: ProjectileMotionState }) {
  const length = motion.rangeWorld + OCEAN_SIDE_MARGIN * 2;
  const width = OCEAN_WIDTH;
  const centerX = PROJECTILE_SCENE.launchOffset[0] + motion.rangeWorld / 2;

  return (
    <group>
      <ReflectiveWater centerX={centerX} length={length} width={width} />
      <WindParticles centerX={centerX} length={length} />
    </group>
  );
}

function ReflectiveWater({
  centerX,
  length,
  width,
}: {
  centerX: number;
  length: number;
  width: number;
}) {
  const waterNormals = useLoader(TextureLoader, WATER_NORMALS_PATH);
  const water = useMemo(() => {
    waterNormals.wrapS = RepeatWrapping;
    waterNormals.wrapT = RepeatWrapping;
    waterNormals.needsUpdate = true;

    const geometry = new PlaneGeometry(length, width, 1, 1);
    const instance = new Water(geometry, {
      alpha: 0.96,
      distortionScale: 3.2,
      side: DoubleSide,
      sunColor: OCEAN_COLORS.sun,
      sunDirection: new Vector3(0.32, 0.72, 0.42).normalize(),
      textureHeight: 512,
      textureWidth: 512,
      waterColor: OCEAN_COLORS.water,
      waterNormals,
    });

    instance.position.set(centerX, -0.12, 0);
    instance.receiveShadow = true;
    instance.rotation.x = -Math.PI / 2;

    return instance;
  }, [centerX, length, waterNormals, width]);

  useEffect(
    () => () => {
      water.geometry.dispose();
      water.material.dispose();
    },
    [water]
  );

  useFrame((_, delta) => {
    water.material.uniforms.time.value += delta * 0.55;
  });

  return <primitive object={water} />;
}

function WindParticles({
  centerX,
  length,
}: {
  centerX: number;
  length: number;
}) {
  return (
    <group>
      {WIND_PARTICLES.map((particle) => (
        <WindParticle
          centerX={centerX}
          key={particle.id}
          length={length}
          particle={particle}
        />
      ))}
    </group>
  );
}

function WindParticle({
  centerX,
  length,
  particle,
}: {
  centerX: number;
  length: number;
  particle: (typeof WIND_PARTICLES)[number];
}) {
  const particleRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const mesh = particleRef.current;

    if (!mesh) {
      return;
    }

    const loop = (particle.offset + clock.elapsedTime * particle.speed) % 1;
    const x = centerX - length / 2 + loop * length;
    const y =
      particle.y + Math.sin(clock.elapsedTime * 1.1 + particle.progress) * 0.05;

    mesh.position.set(x, y, particle.z);
  });

  return (
    <mesh ref={particleRef}>
      <sphereGeometry args={[particle.radius, 10, 8]} />
      <meshBasicMaterial
        color={OCEAN_COLORS.particle}
        depthWrite={false}
        opacity={0.38}
        transparent
      />
    </mesh>
  );
}
