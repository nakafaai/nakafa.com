import { useFrame } from "@react-three/fiber";
import { getAtomSceneColors } from "@repo/design-system/components/contents/chemistry/color";
import type { layoutReaction } from "@repo/design-system/components/contents/chemistry/equation/layout";
import {
  advanceProgress,
  bondStrengths,
  particlePosition,
} from "@repo/design-system/components/contents/chemistry/equation/progress";
import { useReactionProgress } from "@repo/design-system/components/contents/chemistry/equation/store";
import type {
  Bond,
  Point,
} from "@repo/design-system/components/contents/chemistry/molecule/geometry";
import {
  AtomBall,
  BondSticks,
  FixedBond,
  placeBond,
} from "@repo/design-system/components/contents/chemistry/molecule/model";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { getColor } from "@repo/design-system/lib/color";
import { useTheme } from "@repo/design-system/providers/theme";
import { Array as Arr, Option, type Result } from "effect";
import {
  createRef,
  type ReactNode,
  type RefObject,
  useMemo,
  useRef,
} from "react";
import type { Group, Mesh } from "three";

/** A reaction laid out for the lab. */
export type ReactionLayout = Result.Result.Success<
  ReturnType<typeof layoutReaction>
>;

/** How much of an atom a ghost of the molecules before and after keeps. */
const GHOST = 0.14;

/** The least change of progress the slider is told about while the card plays. */
const SLIDER_STEP = 0.01;

/** Stands every bond of one set between its atoms, as thick as `strength`. */
function placeBonds(
  bonds: readonly Bond[],
  refs: readonly RefObject<Group | null>[],
  positions: readonly Point[],
  strength: number
) {
  for (const [bond, ref] of Arr.zip(bonds, refs)) {
    const group = ref.current;
    const ends = Option.all([
      Arr.get(positions, bond.from),
      Arr.get(positions, bond.to),
    ]);
    if (group === null || Option.isNone(ends)) {
      continue;
    }
    placeBond(group, ends.value);
    group.visible = strength > 0.02;
    group.scale.x = strength;
    group.scale.z = strength;
  }
}

/**
 * A reaction as it happens to its atoms: the reactant molecules on the left
 * jostle, their bonds thin away, every atom flies on an arc to its place in a
 * product on the right, and the new bonds grow. No atom appears or vanishes on
 * the way, so the reader watches the equation balance itself. While the card
 * plays the run loops; the slider scrubs it by hand.
 */
export function ReactionScene({
  layout,
  products,
  reactants,
}: {
  readonly layout: ReactionLayout;
  readonly products: ReactNode;
  readonly reactants: ReactNode;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
  const colors = getAtomSceneColors(resolvedTheme);
  const store = useReactionProgress();
  const shown = useRef(store.getState().progress);
  const atomRefs = useMemo(
    () => Arr.map(layout.particles, () => createRef<Mesh>()),
    [layout]
  );
  const reactantRefs = useMemo(
    () => Arr.map(layout.reactantBonds, () => createRef<Group>()),
    [layout]
  );
  const productRefs = useMemo(
    () => Arr.map(layout.productBonds, () => createRef<Group>()),
    [layout]
  );

  useFrame((_, seconds) => {
    const state = store.getState();
    if (playing) {
      shown.current = advanceProgress(shown.current, seconds);
      if (Math.abs(shown.current - state.progress) >= SLIDER_STEP) {
        state.setProgress(shown.current);
      }
    } else {
      shown.current = state.progress;
    }
    const progress = Math.min(1, shown.current);
    const positions = Arr.map(layout.particles, (particle) =>
      particlePosition(particle, progress)
    );
    for (const [ref, position] of Arr.zip(atomRefs, positions)) {
      ref.current?.position.set(position[0], position[1], position[2]);
    }
    const strengths = bondStrengths(progress);
    placeBonds(
      layout.reactantBonds,
      reactantRefs,
      positions,
      strengths.reactants
    );
    placeBonds(layout.productBonds, productRefs, positions, strengths.products);
  });

  const sideX = layout.span / 4 + 0.65;
  const labelY = -layout.span / 6 - 1.1;

  return (
    <group>
      {Arr.map(Arr.zip(layout.particles, atomRefs), ([particle, ref]) => (
        <AtomBall
          element={particle.element}
          key={`particle-${particle.reactant}`}
          position={particle.start}
          ref={ref}
          style="ball"
        />
      ))}
      {Arr.map(Arr.zip(layout.reactantBonds, reactantRefs), ([bond, ref]) => (
        <BondSticks
          elements={bond.elements}
          key={`reactant-${bond.from}-${bond.to}`}
          order={bond.order}
          ref={ref}
        />
      ))}
      {Arr.map(Arr.zip(layout.productBonds, productRefs), ([bond, ref]) => (
        <BondSticks
          elements={bond.elements}
          key={`product-${bond.from}-${bond.to}`}
          order={bond.order}
          ref={ref}
        />
      ))}
      <ReactionGhosts layout={layout} />
      <ReactionArrow />
      <ThreeLabel
        color={colors.text}
        fontSize="compact"
        position={[-sideX, labelY, 0]}
      >
        {reactants}
      </ThreeLabel>
      <ThreeLabel
        color={colors.text}
        fontSize="compact"
        position={[sideX, labelY, 0]}
      >
        {products}
      </ThreeLabel>
    </group>
  );
}

/**
 * Faint outlines of the reactants where they started and the products where
 * they end, so the whole equation stays in view while the atoms travel.
 */
function ReactionGhosts({ layout }: { readonly layout: ReactionLayout }) {
  const sides = [
    {
      bonds: layout.reactantBonds,
      key: "start",
      place: (particle: ReactionLayout["particles"][number]) => particle.start,
    },
    {
      bonds: layout.productBonds,
      key: "end",
      place: (particle: ReactionLayout["particles"][number]) => particle.end,
    },
  ] as const;

  return (
    <group>
      {Arr.map(sides, (side) => (
        <group key={side.key}>
          {Arr.map(layout.particles, (particle) => (
            <AtomBall
              element={particle.element}
              key={`${side.key}-${particle.reactant}`}
              opacity={GHOST}
              position={side.place(particle)}
              style="ball"
            />
          ))}
          {Arr.flatMap(side.bonds, (bond) =>
            Option.match(
              Option.all([
                Option.map(Arr.get(layout.particles, bond.from), side.place),
                Option.map(Arr.get(layout.particles, bond.to), side.place),
              ]),
              {
                onNone: () => [],
                onSome: (ends) => [
                  <FixedBond
                    bond={bond}
                    ends={ends}
                    key={`${side.key}-${bond.from}-${bond.to}`}
                    opacity={GHOST}
                  />,
                ],
              }
            )
          )}
        </group>
      ))}
    </group>
  );
}

/** The arrow of the equation, standing between the two sides as a steel rod. */
function ReactionArrow() {
  return (
    <group rotation={[0, 0, -Math.PI / 2]}>
      <mesh castShadow position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 1.1, 24]} />
        <MetalMaterial color={getColor("SLATE", 400)} />
      </mesh>
      <mesh castShadow position={[0, 0.55, 0]}>
        <coneGeometry args={[0.18, 0.42, 32]} />
        <MetalMaterial color={getColor("SLATE", 400)} />
      </mesh>
    </group>
  );
}
