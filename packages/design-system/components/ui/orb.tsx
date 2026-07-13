"use client";

import { useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useStableMutableValue } from "@repo/design-system/hooks/use-stable-mutable-value";
import {
  ORB_FRAGMENT_SHADER,
  ORB_VERTEX_SHADER,
} from "@repo/design-system/lib/orb-shaders";
import { getThemeAppearance } from "@repo/design-system/lib/theme";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export type AgentState = null | "thinking" | "listening" | "talking";

interface OrbProps {
  agentState?: AgentState;
  className?: string;
  colors?: [string, string];
  colorsRef?: React.RefObject<[string, string]>;
  getInputVolume?: () => number;
  getOutputVolume?: () => number;
  inputVolumeRef?: React.RefObject<number>;
  manualInput?: number;
  manualOutput?: number;
  outputVolumeRef?: React.RefObject<number>;
  resizeDebounce?: number;
  seed?: number;
  volumeMode?: "auto" | "manual";
}

/**
 * Renders the animated voice orb canvas used for listening and speaking states.
 */
export function Orb({
  colors = ["#CADCFC", "#A0B9D1"],
  colorsRef,
  resizeDebounce = 100,
  seed,
  agentState = null,
  volumeMode = "auto",
  manualInput,
  manualOutput,
  inputVolumeRef,
  outputVolumeRef,
  getInputVolume,
  getOutputVolume,
  className,
}: OrbProps) {
  return (
    <div className={className ?? "relative h-full w-full"}>
      <Canvas
        gl={{
          alpha: true,
          antialias: true,
          premultipliedAlpha: true,
        }}
        resize={{ debounce: resizeDebounce }}
      >
        <Scene
          agentState={agentState}
          colors={colors}
          colorsRef={colorsRef}
          getInputVolume={getInputVolume}
          getOutputVolume={getOutputVolume}
          inputVolumeRef={inputVolumeRef}
          manualInput={manualInput}
          manualOutput={manualOutput}
          outputVolumeRef={outputVolumeRef}
          seed={seed}
          volumeMode={volumeMode}
        />
      </Canvas>
    </div>
  );
}

/**
 * Owns the Three.js scene, uniforms, and per-frame orb animation state.
 */
function Scene({
  colors,
  colorsRef,
  seed,
  agentState,
  volumeMode,
  manualInput,
  manualOutput,
  inputVolumeRef,
  outputVolumeRef,
  getInputVolume,
  getOutputVolume,
}: {
  colors: [string, string];
  colorsRef?: React.RefObject<[string, string]>;
  seed?: number;
  agentState: AgentState;
  volumeMode: "auto" | "manual";
  manualInput?: number;
  manualOutput?: number;
  inputVolumeRef?: React.RefObject<number>;
  outputVolumeRef?: React.RefObject<number>;
  getInputVolume?: () => number;
  getOutputVolume?: () => number;
}) {
  const { gl } = useThree();
  const { resolvedTheme } = useTheme();
  const isDarkTheme = getThemeAppearance(resolvedTheme) === "dark";
  const circleRef =
    useRef<THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial>>(null);
  const initialColorsRef = useRef<[string, string]>(colors);
  const targetColor1 = useStableMutableValue(() => new THREE.Color(colors[0]));
  const targetColor2 = useStableMutableValue(() => new THREE.Color(colors[1]));
  const invertedUniform = useStableMutableValue(
    () => new THREE.Uniform(isDarkTheme ? 1 : 0)
  );
  const animSpeedRef = useRef(0.1);
  const perlinNoiseTexture = useTexture(
    "https://storage.googleapis.com/eleven-public-cdn/images/perlin-noise.png"
  );

  const agentRef = useRef<AgentState>(agentState);
  const modeRef = useRef<"auto" | "manual">(volumeMode);
  const manualInRef = useRef<number>(manualInput ?? 0);
  const manualOutRef = useRef<number>(manualOutput ?? 0);
  const curInRef = useRef(0);
  const curOutRef = useRef(0);

  useEffect(() => {
    agentRef.current = agentState;
  }, [agentState]);

  useEffect(() => {
    modeRef.current = volumeMode;
  }, [volumeMode]);

  useEffect(() => {
    manualInRef.current = clamp01(
      manualInput ?? inputVolumeRef?.current ?? getInputVolume?.() ?? 0
    );
  }, [manualInput, inputVolumeRef, getInputVolume]);

  useEffect(() => {
    manualOutRef.current = clamp01(
      manualOutput ?? outputVolumeRef?.current ?? getOutputVolume?.() ?? 0
    );
  }, [manualOutput, outputVolumeRef, getOutputVolume]);

  const random = useMemo(
    () => splitmix32(seed ?? Math.floor(Math.random() * 2 ** 32)),
    [seed]
  );
  const offsets = useMemo(
    () =>
      new Float32Array(Array.from({ length: 7 }, () => random() * Math.PI * 2)),
    [random]
  );

  useEffect(() => {
    targetColor1.set(colors[0]);
    targetColor2.set(colors[1]);
  }, [colors, targetColor1, targetColor2]);

  useEffect(() => {
    invertedUniform.value = isDarkTheme ? 1 : 0;
  }, [invertedUniform, isDarkTheme]);

  useFrame((_, delta: number) => {
    const mat = circleRef.current?.material;
    if (!mat) {
      return;
    }
    const live = colorsRef?.current;
    if (live) {
      if (live[0]) {
        targetColor1.set(live[0]);
      }
      if (live[1]) {
        targetColor2.set(live[1]);
      }
    }
    const u = mat.uniforms;
    u.uTime.value += delta * 0.5;

    if (u.uOpacity.value < 1) {
      u.uOpacity.value = Math.min(1, u.uOpacity.value + delta * 2);
    }

    let targetIn = 0;
    let targetOut = 0.3;
    if (modeRef.current === "manual") {
      targetIn = clamp01(
        manualInput ?? inputVolumeRef?.current ?? getInputVolume?.() ?? 0
      );
      targetOut = clamp01(
        manualOutput ?? outputVolumeRef?.current ?? getOutputVolume?.() ?? 0
      );
    } else {
      const t = u.uTime.value * 2;
      if (agentRef.current === null) {
        targetIn = 0;
        targetOut = 0.3;
      } else if (agentRef.current === "listening") {
        targetIn = clamp01(0.55 + Math.sin(t * 3.2) * 0.35);
        targetOut = 0.45;
      } else if (agentRef.current === "talking") {
        targetIn = clamp01(0.65 + Math.sin(t * 4.8) * 0.22);
        targetOut = clamp01(0.75 + Math.sin(t * 3.6) * 0.22);
      } else {
        const base = 0.38 + 0.07 * Math.sin(t * 0.7);
        const wander = 0.05 * Math.sin(t * 2.1) * Math.sin(t * 0.37 + 1.2);
        targetIn = clamp01(base + wander);
        targetOut = clamp01(0.48 + 0.12 * Math.sin(t * 1.05 + 0.6));
      }
    }

    curInRef.current += (targetIn - curInRef.current) * 0.2;
    curOutRef.current += (targetOut - curOutRef.current) * 0.2;

    const targetSpeed = 0.1 + (1 - (curOutRef.current - 1) ** 2) * 0.9;
    animSpeedRef.current += (targetSpeed - animSpeedRef.current) * 0.12;

    u.uAnimation.value += delta * animSpeedRef.current;
    u.uInputVolume.value = curInRef.current;
    u.uOutputVolume.value = curOutRef.current;
    u.uColor1.value.lerp(targetColor1, 0.08);
    u.uColor2.value.lerp(targetColor2, 0.08);
  });

  useEffect(() => {
    const canvas = gl.domElement;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setTimeout(() => {
        gl.forceContextRestore();
      }, 1);
    };
    canvas.addEventListener("webglcontextlost", onContextLost, false);
    return () =>
      canvas.removeEventListener("webglcontextlost", onContextLost, false);
  }, [gl]);

  const uniforms = useMemo(() => {
    perlinNoiseTexture.wrapS = THREE.RepeatWrapping;
    perlinNoiseTexture.wrapT = THREE.RepeatWrapping;
    return {
      uColor1: new THREE.Uniform(new THREE.Color(initialColorsRef.current[0])),
      uColor2: new THREE.Uniform(new THREE.Color(initialColorsRef.current[1])),
      uOffsets: { value: offsets },
      uPerlinTexture: new THREE.Uniform(perlinNoiseTexture),
      uTime: new THREE.Uniform(0),
      uAnimation: new THREE.Uniform(0.1),
      uInverted: invertedUniform,
      uInputVolume: new THREE.Uniform(0),
      uOutputVolume: new THREE.Uniform(0),
      uOpacity: new THREE.Uniform(0),
    };
  }, [invertedUniform, offsets, perlinNoiseTexture]);

  return (
    <mesh ref={circleRef}>
      <circleGeometry args={[3.5, 64]} />
      <shaderMaterial
        fragmentShader={ORB_FRAGMENT_SHADER}
        transparent={true}
        uniforms={uniforms}
        vertexShader={ORB_VERTEX_SHADER}
      />
    </mesh>
  );
}

/**
 * Creates a deterministic 32-bit pseudo-random number generator.
 */
function splitmix32(initialSeed: number) {
  // biome-ignore lint/suspicious/noBitwiseOperators: <Required for PRNG>
  let state = initialSeed | 0;
  return () => {
    // biome-ignore lint/suspicious/noBitwiseOperators: <Required for PRNG>
    state = (state + 0x9e_37_79_b9) | 0;
    // biome-ignore lint/suspicious/noBitwiseOperators: <Required for PRNG>
    let t = state ^ (state >>> 16);
    t = Math.imul(t, 0x21_f0_aa_ad);
    // biome-ignore lint/suspicious/noBitwiseOperators: <Required for PRNG>
    t ^= t >>> 15;
    t = Math.imul(t, 0x73_5a_2d_97);
    // biome-ignore lint/suspicious/noBitwiseOperators: <Required for PRNG>
    return ((t ^ (t >>> 15)) >>> 0) / 4_294_967_296;
  };
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(1, Math.max(0, n));
}
