import { useFrame } from "@react-three/fiber";
import type { Point } from "@repo/design-system/components/contents/biology/synapse/anatomy";
import {
  BILAYER,
  ENZYMES,
  FIELD,
  RELEASE,
  TRANSPORTERS,
} from "@repo/design-system/components/contents/biology/synapse/anatomy";
import { useSynapse } from "@repo/design-system/components/contents/biology/synapse/context";
import {
  SHOWN,
  topNormal,
} from "@repo/design-system/components/contents/biology/synapse/dendrite";
import {
  CROSSING,
  clearance,
  DELAY,
  phaseOf,
  receptorsAt,
  released,
  shownAt,
  synapseTime,
  transmitterAt,
} from "@repo/design-system/components/contents/biology/synapse/transmission";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { SYNAPSE_COLORS } from "@repo/design-system/lib/material/synapse";
import { Array as Arr } from "effect";
import { useEffect, useMemo, useRef } from "react";
import type { InstancedMesh } from "three";
import {
  Color,
  Float32BufferAttribute,
  Object3D,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Free acetylcholine molecules the lab draws for one impulse's release, each standing for about 600. */
const POOL = 32;

/** Seconds on the screen the released molecules take to spread across the cleft. */
const SPREAD = 0.45;

/** Seconds on the screen a molecule takes to reach the enzyme that splits it, and choline its transporter. */
const TRIP = { choline: 1.1, enzyme: 0.35, inside: 0.4 };

/** Where an enzyme's active site opens, above its anchor on the membrane. */
const ACTIVE_SITE = 1.2;

/** How a share of a step eases in and out. */
function ease(share: number) {
  const clamped = Math.min(1, Math.max(0, share));
  return clamped * clamped * (3 - 2 * clamped);
}

/** The point nearest `from` among `places`. */
function closest(from: Point, places: readonly Point[]) {
  return Arr.reduce(places, places[0] ?? from, (best, place) =>
    Math.hypot(place[0] - from[0], place[2] - from[2]) <
    Math.hypot(best[0] - from[0], best[2] - from[2])
      ? place
      : best
  );
}

/**
 * Two beads fused into one molecule, each with its own colour: acetylcholine
 * as its choline and acetyl ends, nicotine as its two rings. Molecules are
 * drawn about eight times their size, so they show.
 */
function usePair(
  first: string,
  second: string,
  sizes: readonly [number, number]
) {
  const shape = useMemo(() => {
    const parts = Arr.map(
      [
        [sizes[0], -sizes[1] * 0.75, first],
        [sizes[1], sizes[0] * 0.75, second],
      ] as const,
      ([radius, x, tone]) => {
        const bead = new SphereGeometry(radius, 14, 10).translate(x, 0, 0);
        const color = new Color(tone);
        bead.setAttribute(
          "color",
          new Float32BufferAttribute(
            Arr.flatMap(Arr.range(1, bead.getAttribute("position").count), () =>
              color.toArray()
            ),
            3
          )
        );
        return bead;
      }
    );
    const merged = mergeGeometries(parts);
    Arr.forEach(parts, (part) => part.dispose());
    return merged;
  }, [first, second, sizes]);
  useEffect(() => () => shape.dispose(), [shape]);
  return shape;
}

/** The sizes of the drawn molecules' beads, in units of 10 nm. */
const BEADS = {
  acetylcholine: [0.26, 0.19] as const,
  nicotine: [0.2, 0.17] as const,
};

/**
 * The acetylcholine of one impulse: it leaves the fusing vesicles, spreads
 * across the cleft, and meets acetylcholinesterase, which splits it into
 * choline, taken back into the bouton by its transporter, and acetate,
 * which drifts away. How many molecules are left follows the model's decay;
 * once an organophosphate blocks the enzyme they linger and slowly leave the
 * cleft whole.
 */
export function Acetylcholine() {
  const { clock, rate, treatment } = useSynapse();
  const pair = usePair(
    SYNAPSE_COLORS.acetylcholine,
    SYNAPSE_COLORS.acetate,
    BEADS.acetylcholine
  );
  const molecules = useRef<InstancedMesh>(null);
  const cholines = useRef<InstancedMesh>(null);
  const acetates = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const at = useMemo(() => new Vector3(), []);
  const plans = useMemo(
    () =>
      Arr.map(Arr.range(0, POOL - 1), (index) => {
        const pore = RELEASE[index % 2] ?? [0, 3, -2];
        const angle = 2 * Math.PI * hashUnit(index, 1);
        const reach = 1 + 6.5 * hashUnit(index, 2);
        const spot: Point = [
          pore[0] + reach * Math.cos(angle),
          0.95 + 1.45 * hashUnit(index, 3),
          Math.min(-0.6, pore[2] + 0.7 * reach * Math.sin(angle)),
        ];
        const enzyme = closest(spot, ENZYMES);
        const site: Point = [enzyme[0], enzyme[1] + ACTIVE_SITE, enzyme[2]];
        const transporter = closest(site, TRANSPORTERS);
        const exit: Point = [Math.sign(spot[0] - pore[0]) * 19, 1.5, spot[2]];
        return {
          exit,
          pore,
          site,
          spin: 2 * Math.PI * hashUnit(index, 4),
          spot,
          transporter,
          wobble: hashUnit(index, 6),
        };
      }),
    []
  );
  // Each drawn molecule is split once the model's acetylcholine falls below
  // its share of the release, the first ones at once and the last after
  // several time constants.
  const splits = useMemo(
    () =>
      Arr.map(plans, (_, index) =>
        shownAt(
          DELAY - clearance(treatment) * Math.log((index + 0.5) / POOL),
          rate
        )
      ),
    [plans, rate, treatment]
  );

  useFrame(() => {
    const whole = molecules.current;
    const choline = cholines.current;
    const acetate = acetates.current;
    if (whole === null || choline === null || acetate === null) {
      return;
    }
    const { within } = phaseOf(clock.current);
    const start = shownAt(DELAY, rate);
    const blocked = treatment === "organophosphate";
    const any = released(treatment) > 0;
    Arr.forEach(plans, (plan, index) => {
      const split = splits[index] ?? 0;
      const free = any && within >= start && within < split;
      const spread = ease((within - start) / SPREAD);
      at.set(
        plan.pore[0] + (plan.spot[0] - plan.pore[0]) * spread,
        plan.pore[1] - 0.25 + (plan.spot[1] - plan.pore[1] + 0.25) * spread,
        plan.pore[2] + (plan.spot[2] - plan.pore[2]) * spread
      );
      const wander = 0.3 * spread;
      at.x += wander * Math.sin(within * 2.3 + plan.wobble * 9);
      at.y += 0.4 * wander * Math.sin(within * 3.1 + plan.wobble * 5);
      const leave = ease((within - (split - TRIP.enzyme)) / TRIP.enzyme);
      const goal = blocked ? plan.exit : plan.site;
      at.lerp(
        dummy.position.set(goal[0], goal[1], goal[2]),
        Math.min(1, leave)
      );
      dummy.position.copy(at);
      dummy.rotation.set(plan.spin, within + plan.spin, 0);
      dummy.scale.setScalar(free ? 1 - (blocked ? leave : 0) + 0.0001 : 0.0001);
      dummy.updateMatrix();
      whole.setMatrixAt(index, dummy.matrix);

      const after = within - split;
      const shown = any && !blocked && after >= 0;
      const back = ease(after / TRIP.choline);
      const into = ease((after - TRIP.choline) / TRIP.inside);
      const [tx, ty, tz] = plan.transporter;
      dummy.position.set(
        plan.site[0] + (tx - plan.site[0]) * back,
        plan.site[1] +
          (ty - 0.25 - plan.site[1]) * back +
          (BILAYER + 0.9) * into,
        plan.site[2] + (tz - plan.site[2]) * back
      );
      dummy.scale.setScalar(
        shown ? BEADS.acetylcholine[0] * (1 - into) + 0.0001 : 0.0001
      );
      dummy.updateMatrix();
      choline.setMatrixAt(index, dummy.matrix);

      const drift = ease(after / 1.3);
      dummy.position.set(
        plan.site[0] + 2.4 * drift * Math.cos(plan.spin),
        plan.site[1] - 0.3 * drift,
        Math.min(-0.4, plan.site[2] + 1.6 * drift * Math.sin(plan.spin))
      );
      dummy.scale.setScalar(
        shown ? BEADS.acetylcholine[1] * (1 - drift) + 0.0001 : 0.0001
      );
      dummy.updateMatrix();
      acetate.setMatrixAt(index, dummy.matrix);
    });
    whole.instanceMatrix.needsUpdate = true;
    choline.instanceMatrix.needsUpdate = true;
    acetate.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh args={[pair, undefined, POOL]} ref={molecules}>
        <meshPhysicalMaterial clearcoat={0.7} roughness={0.32} vertexColors />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, POOL]} ref={cholines}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshPhysicalMaterial
          clearcoat={0.7}
          color={SYNAPSE_COLORS.choline}
          roughness={0.32}
        />
      </instancedMesh>
      <instancedMesh args={[undefined, undefined, POOL]} ref={acetates}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshPhysicalMaterial
          clearcoat={0.7}
          color={SYNAPSE_COLORS.acetate}
          roughness={0.32}
        />
      </instancedMesh>
    </group>
  );
}

/** Where a receptor's binding site `site` sits: in a pocket on either side of its ligand-binding domain. */
function sitePosition([x, y, z]: Point, site: number, into: Vector3) {
  const [, ny, nz] = topNormal(z);
  return into.set(
    x + (site === 0 ? -0.36 : 0.36),
    y + 0.36 * ny,
    z + 0.36 * nz
  );
}

/**
 * The ligands on the binding sites of the receptors nearest the release
 * sites: acetylcholine, nicotine or curare, as the model shares the sites
 * among them.
 */
export function Ligands() {
  const { clock, rate, treatment } = useSynapse();
  const acetylcholine = usePair(
    SYNAPSE_COLORS.acetylcholine,
    SYNAPSE_COLORS.acetate,
    BEADS.acetylcholine
  );
  const nicotine = usePair(
    SYNAPSE_COLORS.nicotine,
    SYNAPSE_COLORS.nicotine,
    BEADS.nicotine
  );
  const meshes = {
    acetylcholine: useRef<InstancedMesh>(null),
    curare: useRef<InstancedMesh>(null),
    nicotine: useRef<InstancedMesh>(null),
  };
  const dummy = useMemo(() => new Object3D(), []);
  const step = useRef(-1);
  const shown = Arr.take(FIELD, SHOWN);

  useFrame(() => {
    const now = Math.round(clock.current * 20);
    if (now === step.current) {
      return;
    }
    step.current = now;
    const time = synapseTime(clock.current, rate);
    const drawn = receptorsAt(
      transmitterAt(time - CROSSING, rate, treatment),
      treatment,
      SHOWN
    );
    Arr.forEach(["acetylcholine", "curare", "nicotine"] as const, (ligand) => {
      const target = meshes[ligand].current;
      if (target === null) {
        return;
      }
      Arr.forEach(shown, (place, receptor) => {
        Arr.forEach([0, 1] as const, (site) => {
          const holds = drawn[receptor]?.sites[site] === ligand;
          sitePosition(place, site, dummy.position);
          dummy.rotation.set(0, 0, site === 0 ? 0.5 : -0.5 + Math.PI);
          dummy.scale.setScalar(holds ? 0.85 : 0.0001);
          dummy.updateMatrix();
          target.setMatrixAt(receptor * 2 + site, dummy.matrix);
        });
      });
      target.instanceMatrix.needsUpdate = true;
    });
  });

  return (
    <group>
      <instancedMesh
        args={[acetylcholine, undefined, SHOWN * 2]}
        ref={meshes.acetylcholine}
      >
        <meshPhysicalMaterial clearcoat={0.7} roughness={0.32} vertexColors />
      </instancedMesh>
      <instancedMesh
        args={[nicotine, undefined, SHOWN * 2]}
        ref={meshes.nicotine}
      >
        <meshPhysicalMaterial clearcoat={0.7} roughness={0.32} vertexColors />
      </instancedMesh>
      <instancedMesh
        args={[undefined, undefined, SHOWN * 2]}
        ref={meshes.curare}
      >
        <dodecahedronGeometry args={[0.32, 1]} />
        <meshPhysicalMaterial
          clearcoat={0.5}
          color={SYNAPSE_COLORS.curare}
          roughness={0.45}
        />
      </instancedMesh>
    </group>
  );
}
