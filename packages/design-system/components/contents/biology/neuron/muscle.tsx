import { BRANCHING } from "@repo/design-system/components/contents/biology/neuron/course";
import {
  rounded,
  sweep,
  TissueMaterial,
  useOwned,
} from "@repo/design-system/components/contents/biology/neuron/tissue";
import {
  hashUnit,
  valueNoise,
} from "@repo/design-system/components/contents/simulation/grain";
import { NEURON_COLORS } from "@repo/design-system/lib/material/neuron";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  Color,
  LineCurve3,
  MeshPhysicalMaterial,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The skeletal muscle fibres the neuron drives, each about 45 µm across
 * (OpenStax Anatomy and Physiology 2e, section 10.2: up to 100 µm), lying
 * side by side, each a little behind and above the last, and running away
 * from the reader to the right. They run on far past the card, as fibres
 * centimetres long do.
 */
const FIBRES = [
  { centre: new Vector3(0, -14, 4.4), radius: 2.3, seed: 1 },
  { centre: new Vector3(0, -12, -0.4), radius: 2.2, seed: 2 },
  { centre: new Vector3(0, -10.3, -5.1), radius: 2.25, seed: 3 },
] as const;

/** How far the fibres turn from running across the card to running away from the reader, in radians. */
const YAW = 0.22;

/** How far each fibre runs either side of its centre. */
const REACH = 60;

/**
 * One sarcomere, the repeat of a fibre's cross-striations, in drawing units:
 * 2.2 µm, inside the 2.0 to 2.25 µm at which its filaments overlap fully
 * (Gordon, Huxley and Julian, J. Physiol. 184: 170-192, 1966), and the dark
 * A band 1.6 µm of it, the length of the thick filaments.
 */
const SARCOMERE = { band: 0.16, length: 0.22 } as const;

/**
 * Where each fibre's end plate sits: how far along it, and how far round
 * from its top toward the reader, in radians.
 */
const PLATES = [
  { along: 4.2, turn: 0.72 },
  { along: 1.4, turn: 0.38 },
  { along: -1.2, turn: 0.18 },
] as const;

/** The world's up, the axis the fibres turn about. */
const UP = new Vector3(0, 1, 0);

/**
 * How much of a myonucleus lies under `x` along fibre `index` and `angle`
 * round it, from 0 to 1: skeletal muscle fibres hold many flattened, oval
 * nuclei just under their membrane, spread along their length.
 */
function nucleiAt(index: 0 | 1 | 2, x: number, angle: number) {
  const { seed } = FIBRES[index];
  return Arr.reduce(Arr.range(0, 13), 0, (sum, nucleus) => {
    const at = -30 + nucleus * 4.6 + 2.4 * hashUnit(nucleus, seed);
    const round = 0.2 + 2.2 * hashUnit(nucleus, seed + 5);
    return (
      sum +
      Math.exp(-(((x - at) / 1.1) ** 2)) *
        Math.max(0, Math.cos(angle - round)) ** 60
    );
  });
}

/** How far fibre `index`'s skin lies from its axis at `x` along it and `angle` round from its top toward the reader. */
function skin(index: 0 | 1 | 2, x: number, angle: number) {
  const fibre = FIBRES[index];
  const swell =
    1 + 0.03 * (valueNoise(x * 0.25 + fibre.seed * 9, angle * 1.2, 64) - 0.5);
  return (
    fibre.radius * swell +
    0.07 * nucleiAt(index, x, angle) +
    0.16 * sole(index, x, angle)
  );
}

/** How much of the raised sole plate lies under `x` and `angle` on fibre `index`, from 0 to 1. */
function sole(index: 0 | 1 | 2, x: number, angle: number) {
  const plate = PLATES[index];
  return (
    Math.exp(-(((x - plate.along) / 1.6) ** 2)) *
    Math.max(0, Math.cos(angle - plate.turn)) ** 6
  );
}

/** The point `lift` units above fibre `index`'s skin at `x` along it and `angle` round it. */
function surface(index: 0 | 1 | 2, x: number, angle: number, lift: number) {
  const reach = skin(index, x, angle) + lift;
  return new Vector3(x, Math.cos(angle) * reach, Math.sin(angle) * reach)
    .applyAxisAngle(UP, YAW)
    .add(FIBRES[index].centre);
}

/**
 * Cross-striated sarcoplasm: a moist red tissue whose colour darkens along
 * each A band and at each Z line, the bands fading where they would be finer
 * than a pixel so they never shimmer.
 */
function useStriated() {
  const material = useMemo(() => {
    const made = new MeshPhysicalMaterial({
      clearcoat: 0.45,
      clearcoatRoughness: 0.4,
      color: NEURON_COLORS.sarcoplasm,
      roughness: 0.5,
      sheen: 0.6,
      sheenColor: NEURON_COLORS.sarcoplasmSheen,
      sheenRoughness: 0.5,
      vertexColors: true,
    });
    made.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vAlong;"
        )
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvAlong = position.x;"
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vAlong;"
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float phase = fract(vAlong / ${SARCOMERE.length.toFixed(3)});
          float width = fwidth(vAlong / ${SARCOMERE.length.toFixed(3)});
          float fade = clamp(1.0 - width * 2.5, 0.0, 1.0);
          float halfBand = ${(SARCOMERE.band / SARCOMERE.length / 2).toFixed(3)};
          float aBand = 1.0 - smoothstep(halfBand - 0.06, halfBand + 0.06, abs(phase - 0.5));
          float zLine = 1.0 - smoothstep(0.0, 0.05, min(phase, 1.0 - phase));
          diffuseColor.rgb *= 1.0 - fade * (0.34 * aBand + 0.3 * zLine);`
        );
    };
    return made;
  }, []);
  return useOwned(material);
}

/**
 * The muscle fibres: long, straight cylinders of sarcoplasm, slightly
 * uneven, with flattened myonuclei bulging under their membrane, and a
 * raised, paler sole plate under each end plate.
 */
export function Muscle() {
  const material = useStriated();
  const parts = useMemo(() => {
    const red = new Color(NEURON_COLORS.sarcoplasm);
    const pale = new Color(NEURON_COLORS.solePlate);
    const nucleus = new Color(NEURON_COLORS.myonucleus);
    return Arr.map([0, 1, 2] as const, (index) =>
      sweep({
        curve: new LineCurve3(
          new Vector3(-REACH, 0, 0),
          new Vector3(REACH, 0, 0)
        ),
        radius: (along, angle) => skin(index, (along * 2 - 1) * REACH, angle),
        rings: 600,
        sides: 48,
        tint: (along, angle) => {
          const x = (along * 2 - 1) * REACH;
          const plate = Math.min(1, 1.4 * sole(index, x, angle));
          const dark = Math.min(0.5, 0.6 * nucleiAt(index, x, angle));
          const tone = 0.92 + 0.08 * hashUnit(index, 17);
          return [
            tone *
              (1 +
                (pale.r / red.r - 1) * plate +
                (nucleus.r / red.r - 1) * dark),
            tone *
              (1 +
                (pale.g / red.g - 1) * plate +
                (nucleus.g / red.g - 1) * dark),
            tone *
              (1 +
                (pale.b / red.b - 1) * plate +
                (nucleus.b / red.b - 1) * dark),
          ];
        },
      })
    );
  }, []);
  useEffect(() => () => Arr.forEach(parts, (part) => part.dispose()), [parts]);
  // Each fibre is swept along its own x, so the striations can follow it.
  return (
    <group>
      {Arr.map(parts, (part, index) => (
        <mesh
          castShadow
          geometry={part}
          key={part.uuid}
          material={material}
          position={FIBRES[index]?.centre}
          receiveShadow
          rotation={[0, YAW, 0]}
        />
      ))}
    </group>
  );
}

/** The point on fibre `index`'s skin at the middle of its end plate, where a label can point. */
export function plateOf(index: 0 | 1 | 2) {
  const plate = PLATES[index];
  return { point: surface(index, plate.along, plate.turn, 0.25) };
}

/** The twig from the branching point to end plate `index`, ending just above the sole plate. */
function twigOf(index: 0 | 1 | 2) {
  const plate = PLATES[index];
  const start = BRANCHING.point
    .clone()
    .addScaledVector(BRANCHING.tangent, 0.25);
  const above = surface(index, plate.along, plate.turn, 0.8);
  const ahead = start
    .clone()
    .lerp(above, 0.4)
    .addScaledVector(BRANCHING.tangent, 0.6);
  return new CatmullRomCurve3(
    [start, ahead, above, surface(index, plate.along, plate.turn, 0.2)],
    false,
    "centripetal"
  );
}

/** The short branches of one end plate, lying in the gutters of its sole plate. */
function gutters(index: 0 | 1 | 2) {
  const plate = PLATES[index];
  const radius = FIBRES[index].radius;
  return Arr.map([0, 1, 2, 3] as const, (branch) => {
    const heading = (branch / 4) * Math.PI * 2 + hashUnit(branch, index) * 0.8;
    const bend = 0.6 * (hashUnit(branch, index + 3) - 0.5);
    const at = (reach: number, side: number) =>
      surface(
        index,
        plate.along + Math.cos(heading + side) * reach * 1.4,
        plate.turn + (Math.sin(heading + side) * reach) / radius,
        0.08
      );
    return new CatmullRomCurve3(
      [at(0, 0), at(0.6, bend), at(1.15, -bend)],
      false,
      "centripetal"
    );
  });
}

/**
 * The axon terminals: from the branching point, three twigs run down to
 * the three fibres and each splits over its end plate into short branches
 * lying in shallow gutters of the sole plate, swollen into boutons that hold
 * the transmitter.
 */
export function Terminals() {
  const geometry = useMemo(() => {
    const twigs = Arr.map([0, 1, 2] as const, (index) =>
      sweep({
        curve: twigOf(index),
        radius: (along) => rounded(0.3 - 0.1 * along, 0.03, along),
        rings: 90,
        sides: 12,
      })
    );
    const branches = Arr.flatMap([0, 1, 2] as const, (index) =>
      Arr.map(gutters(index), (curve, branch) =>
        sweep({
          curve,
          radius: (along) => {
            const swelling =
              Math.max(0, Math.sin(along * Math.PI * 3 + branch)) ** 4;
            return rounded(0.15 + 0.13 * swelling, 0.18, along);
          },
          rings: 40,
          sides: 10,
        })
      )
    );
    const all = [...twigs, ...branches];
    const merged = mergeGeometries(all);
    Arr.forEach(all, (part) => part.dispose());
    return merged;
  }, []);
  useOwned(geometry);
  return (
    <mesh castShadow geometry={geometry} receiveShadow>
      <TissueMaterial color={NEURON_COLORS.neurite} />
    </mesh>
  );
}
