import { useFrame } from "@react-three/fiber";
import type { Fibre } from "@repo/design-system/components/contents/biology/neuron/conduction";
import {
  flowAt,
  potentialAt,
  REST,
} from "@repo/design-system/components/contents/biology/neuron/conduction";
import {
  FAR,
  FAR_CUT,
  FIBRE,
  INITIAL,
  NEAR,
  NEAR_CUT,
  SPACING,
  shareOf,
  stationOf,
} from "@repo/design-system/components/contents/biology/neuron/course";
import {
  arrival,
  CUT,
  END,
} from "@repo/design-system/components/contents/biology/neuron/playback";
import {
  sweep,
  useOwned,
} from "@repo/design-system/components/contents/biology/neuron/tissue";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { useRequired } from "@repo/design-system/hooks/required";
import { NEURON_COLORS } from "@repo/design-system/lib/material/neuron";
import { Array as Arr, Option, Schema } from "effect";
import type { RefObject } from "react";
import { createContext, useMemo, useRef } from "react";
import type { CatmullRomCurve3, InstancedMesh, Mesh, PointLight } from "three";
import {
  BufferAttribute,
  Color,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from "three";

/** What the scene's clock shows now: the real time after the initial segment fired, in ms, and the displayed seconds. */
const ClockSchema = Schema.Struct({
  real: Schema.Finite,
  shown: Schema.Finite,
});
export type Clock = typeof ClockSchema.Type;

/** The impulse the scene plays: along which fibre, how long it is, and the clock the scene advances. */
export const ImpulseContext = createContext<{
  readonly clock: RefObject<Clock>;
  readonly fibre: Fibre;
  readonly length: number;
} | null>(null);

/** Reads the impulse of the surrounding scene. */
function useImpulse() {
  return useRequired(ImpulseContext, "useImpulse");
}

/** The peak of the action potential, which scales the glow of depolarised membrane. */
const PEAK = 30;

/** The glow colours, in linear light. */
const GLOW = {
  current: new Color(NEURON_COLORS.current),
  depolarised: new Color(NEURON_COLORS.depolarised),
  undershoot: new Color(NEURON_COLORS.undershoot),
} as const;

/**
 * The glow of a patch of membrane `local` ms after the local current reaches
 * it: a bright yellow flash while the local current charges it, orange as it
 * depolarises toward the peak, and a faint blue while it undershoots rest.
 * Writes the colour into `into` and returns how strongly it shows, from 0 to
 * 1, so the glow reads over pale tissue on a light card as well as a dark one.
 */
function glow(local: number, into: Color) {
  const voltage = potentialAt(local);
  const flash = flowAt(local).local;
  const warm = Math.min(1, Math.max(0, (voltage - REST) / (PEAK - REST)));
  const cool = 0.5 * Math.min(1, Math.max(0, (REST - voltage) / 10));
  const total = flash + warm + cool;
  if (total < 0.001) {
    into.setRGB(0, 0, 0);
    return 0;
  }
  const mix = (channel: "b" | "g" | "r") =>
    (GLOW.current[channel] * flash +
      GLOW.depolarised[channel] * warm +
      GLOW.undershoot[channel] * cool) /
    total;
  into.setRGB(mix("r"), mix("g"), mix("b"));
  return Math.min(1, total);
}

/** A glow material that lies over the tissue, ignores the scene's lights and fades with its opacity. */
function useGlowMaterial(vertexColors: boolean) {
  return useOwned(
    useMemo(
      () =>
        new MeshBasicMaterial({
          depthWrite: false,
          // A ring fades through its opacity; a sleeve through its colours' alpha.
          opacity: vertexColors ? 1 : 0,
          toneMapped: false,
          transparent: true,
          vertexColors,
        }),
      [vertexColors]
    )
  );
}

/** The drawn positions where a myelinated fibre's membrane fires: the initial segment, each node, and the last heminode. */
const SITES = [0, 1, 2, 3, 4, 5, END] as const;

/**
 * The glow of a myelinated fibre: a ring of light round each node of Ranvier
 * as the local current reaches it and its sodium channels open, and a small
 * light at the newest active node that brightens the myelin round it. The
 * internodes stay dark, because the myelin keeps current from crossing them.
 */
export function NodeGlows() {
  const { clock, fibre, length } = useImpulse();
  const rings = useRef<(Mesh | null)[]>([]);
  const light = useRef<PointLight>(null);
  const colour = useMemo(() => new Color(), []);
  const places = useMemo(
    () =>
      Arr.map(SITES, (site) => {
        const { point, tangent } = stationOf(site);
        return {
          point,
          site,
          turn: new Quaternion().setFromUnitVectors(
            new Vector3(0, 0, 1),
            tangent
          ),
        };
      }),
    []
  );

  useFrame(() => {
    const now = clock.current.real;
    Arr.forEach(places, (place, index) => {
      const ring = rings.current[index];
      if (ring === null || ring === undefined) {
        return;
      }
      const local = now - arrival(fibre, length, place.site);
      const material = ring.material;
      if (material instanceof MeshBasicMaterial) {
        material.opacity = 0.95 * glow(local, material.color);
      }
    });
    const newest = Arr.findLast(
      places,
      (place) => now >= arrival(fibre, length, place.site)
    );
    const lamp = light.current;
    if (lamp === null) {
      return;
    }
    lamp.visible = Option.isSome(newest);
    Option.map(newest, (place) => {
      const local = now - arrival(fibre, length, place.site);
      lamp.position.copy(place.point);
      lamp.intensity = 6 * flowAt(local).local + 3 * flowAt(local).sodium;
      glow(local, colour);
      lamp.color.copy(colour).multiplyScalar(0.6).addScalar(0.15);
    });
  });

  return (
    <group>
      <pointLight distance={6} ref={light} />
      {Arr.map(places, (place, index) => (
        <mesh
          key={place.site}
          position={place.point}
          quaternion={place.turn}
          ref={(mesh) => {
            rings.current[index] = mesh;
          }}
        >
          <torusGeometry args={[FIBRE.node + 0.12, 0.1, 12, 40]} />
          <GlowMaterial />
        </mesh>
      ))}
    </group>
  );
}

/** One glow material for a ring the frame loop colours. */
function GlowMaterial() {
  const material = useGlowMaterial(false);
  return <primitive attach="material" object={material} />;
}

/** The drawn position, in internodes, of a point `length` units along a stretch. */
function placeOf(stretch: "far" | "near", length: number) {
  return stretch === "near"
    ? Math.max(0, (length - INITIAL) / SPACING)
    : CUT + (length - FAR_CUT) / SPACING;
}

/**
 * A sleeve of light round a bare axon, its colour set ring by ring from the
 * potential the impulse has given the membrane there, so the active region
 * slides along it as one continuous wave.
 */
function Sleeve({
  curve,
  from,
  stretch,
  to,
}: {
  readonly curve: CatmullRomCurve3;
  readonly from: number;
  readonly stretch: "far" | "near";
  readonly to: number;
}) {
  const { clock, fibre, length } = useImpulse();
  const rings = Math.round((to - from) * 14);
  const sides = 14;
  const geometry = useOwned(
    useMemo(() => {
      const made = sweep({
        curve,
        from: shareOf(stretch, from),
        radius: () => FIBRE.bare + 0.06,
        rings,
        sides,
        to: shareOf(stretch, to),
      });
      // Each ring also carries how strongly it glows, as its colour's alpha.
      made.setAttribute(
        "color",
        new BufferAttribute(new Float32Array((rings + 1) * (sides + 1) * 4), 4)
      );
      return made;
    }, [curve, from, rings, stretch, to])
  );
  const material = useGlowMaterial(true);
  const colour = useMemo(() => new Color(), []);

  useFrame(() => {
    const colors = geometry.getAttribute("color");
    if (!(colors instanceof BufferAttribute)) {
      return;
    }
    for (const ring of Arr.range(0, rings)) {
      const place = placeOf(stretch, from + ((to - from) * ring) / rings);
      const strength = glow(
        clock.current.real - arrival(fibre, length, place),
        colour
      );
      for (const side of Arr.range(0, sides)) {
        colors.setXYZW(
          ring * (sides + 1) + side,
          colour.r,
          colour.g,
          colour.b,
          0.85 * strength
        );
      }
    }
    colors.needsUpdate = true;
  });

  return <mesh geometry={geometry} material={material} renderOrder={2} />;
}

/** The glow of a bare fibre: one continuous wave along the near stretch and on along the far one. */
export function BareGlow() {
  return (
    <group>
      <Sleeve curve={NEAR} from={0.6} stretch="near" to={NEAR_CUT} />
      <Sleeve
        curve={FAR}
        from={FAR_CUT}
        stretch="far"
        to={FAR_CUT + (END - CUT) * SPACING}
      />
    </group>
  );
}

/** How many ions each site shows crossing at once, of each kind. */
const IONS = 8;

/**
 * Sodium ions (gold) streaming in where the membrane depolarises and
 * potassium ions (violet) streaming out as it repolarises, at each node of a
 * myelinated fibre or every half internode along a bare one. Each ion runs
 * from outside the membrane to inside it, or back, and shows only while its
 * current flows.
 */
export function Ions() {
  const { clock, fibre, length } = useImpulse();
  const sodium = useRef<InstancedMesh>(null);
  const potassium = useRef<InstancedMesh>(null);
  const sites = useMemo(() => {
    const places = fibre.myelinated
      ? [1, 2, 3, 4, 5]
      : Arr.map(Arr.range(0, 12), (step) => step * 0.5);
    return Arr.map(places, (place) => {
      const { point, tangent } = stationOf(place);
      const across = new Vector3(0, 0, 1).cross(tangent).normalize();
      const up = new Vector3().crossVectors(tangent, across).normalize();
      return { across, place, point, up };
    });
  }, [fibre.myelinated]);
  const count = sites.length * IONS;
  const place = useMemo(() => new Object3D(), []);

  useFrame(() => {
    const now = clock.current.real;
    const shown = clock.current.shown;
    Arr.forEach(sites, (site, index) => {
      const flow = flowAt(now - arrival(fibre, length, site.place));
      for (const ion of Arr.range(0, IONS - 1)) {
        const angle = (ion / IONS) * Math.PI * 2 + hashUnit(index, ion) * 0.6;
        const phase = (shown * 0.9 + hashUnit(ion, index + 11)) % 1;
        const slot = index * IONS + ion;
        const inward = 1.25 - phase * 0.95;
        const outward = 0.3 + phase * 0.95;
        // Sodium runs inward and potassium outward, both across the membrane at the node.
        Arr.forEach(
          [
            { mesh: sodium.current, radius: inward, share: flow.sodium },
            { mesh: potassium.current, radius: outward, share: flow.potassium },
          ] as const,
          ({ mesh, radius, share }) => {
            if (mesh === null) {
              return;
            }
            place.position
              .copy(site.point)
              .addScaledVector(site.up, Math.cos(angle) * radius)
              .addScaledVector(site.across, Math.sin(angle) * radius);
            place.scale.setScalar(
              share > 0.04 ? 0.075 * Math.min(1, share * 1.6) : 0
            );
            place.updateMatrix();
            mesh.setMatrixAt(slot, place.matrix);
            mesh.instanceMatrix.needsUpdate = true;
          }
        );
      }
    });
  });

  return (
    <group>
      <instancedMesh
        args={[undefined, undefined, count]}
        frustumCulled={false}
        key={`na-${count}`}
        ref={sodium}
      >
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color={NEURON_COLORS.sodium} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, count]}
        frustumCulled={false}
        key={`k-${count}`}
        ref={potassium}
      >
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color={NEURON_COLORS.potassium} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}
