import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  asideOf,
  crowdMarksOf,
  frameOf,
  MIDDLE,
  marksOf,
  poolsOf,
  standOf,
} from "@repo/design-system/components/contents/biology/lipid/layout";
import type {
  Chain,
  Molecule,
  Scale,
} from "@repo/design-system/components/contents/biology/lipid/packing";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MoleculeModel } from "@repo/design-system/components/three/molecule/kit";
import {
  bilayerOf,
  dropletOf,
  lipidOf,
} from "@repo/design-system/components/three/molecule/lipid";
import { Solvent } from "@repo/design-system/components/three/molecule/solvent";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

/** The names the lab gives the parts of a lipid. */
type Parts = Readonly<
  Record<
    "glycerol" | "fatty" | "ester" | "phosphate" | "head" | "tail" | "kink",
    string
  >
>;

/** Whether the frame is too narrow for labels on both sides of the subject. */
function useNarrow() {
  return isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
}

/**
 * The lipid lab's scene. One molecule is a ball and stick model with every
 * atom: glycerol, the ester bonds, eighteen-carbon fatty acids that run
 * straight when saturated and kink at a cis double bond when not, and the
 * phosphate and choline head of a membrane lipid. Many molecules in water
 * are a space-filling model: a clump of fat that hides its tails from the
 * water, or a patch of bilayer with its heads out and its tails in.
 */
export function LipidScene({
  chain,
  molecule,
  parts,
  scale,
}: {
  readonly chain: Chain;
  readonly molecule: Molecule;
  readonly parts: Parts;
  readonly scale: Scale;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const frame = frameOf(useNarrow());
  const rootRef = useRef<Group>(null);
  const clock = useRef(0);
  const unsaturated = chain === "unsaturated";

  useFrame((_, delta) => {
    if (!playing || rootRef.current === null) {
      return;
    }
    clock.current += simulationStep(delta);
    rootRef.current.position.y =
      Math.sin(clock.current * 2.6) * (unsaturated ? 0.012 : 0.004);
  });

  return (
    <group>
      <CameraControls
        cameraPosition={frame.camera}
        cameraTarget={[0, MIDDLE, 0]}
        fov={38}
      />
      <group ref={rootRef}>
        {scale === "molecule" ? (
          <OneLipid kind={molecule} parts={parts} unsaturated={unsaturated} />
        ) : (
          <ManyLipids kind={molecule} parts={parts} unsaturated={unsaturated} />
        )}
      </group>
    </group>
  );
}

/** One lipid with every atom, in the water it meets, and the names of its parts. */
function OneLipid({
  kind,
  parts,
  unsaturated,
}: {
  readonly kind: Molecule;
  readonly parts: Parts;
  readonly unsaturated: boolean;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const narrow = useNarrow();
  const lipid = useMemo(
    () => lipidOf(kind, unsaturated).molecule,
    [kind, unsaturated]
  );
  const marks = useMemo(
    () => marksOf(kind, unsaturated, narrow),
    [kind, narrow, unsaturated]
  );
  return (
    <group>
      <group position={standOf(narrow)} scale={frameOf(narrow).molecule}>
        <MoleculeModel molecule={lipid} style="sticks" />
        <group position={[0, -8, -32]}>
          <Solvent count={30} inner={14} outer={24} playing={playing} />
        </group>
      </group>
      {Arr.map(marks, (mark) => (
        <ThreeLabel
          anchorX={mark.side === "left" ? "right" : "left"}
          color={ink}
          fontSize={narrow ? "compact" : "annotation"}
          key={mark.part}
          position={mark.at}
        >
          {parts[mark.part]}
        </ThreeLabel>
      ))}
    </group>
  );
}

/** Many lipids in water as a space-filling model of their heavy atoms: a droplet of fat or a patch of bilayer. */
function ManyLipids({
  kind,
  parts,
  unsaturated,
}: {
  readonly kind: Molecule;
  readonly parts: Parts;
  readonly unsaturated: boolean;
}) {
  const ink = useLabelInk();
  const narrow = useNarrow();
  const crowd = useMemo(
    () =>
      kind === "triglyceride"
        ? dropletOf(unsaturated)
        : bilayerOf(unsaturated, unsaturated ? 4 : 3, unsaturated ? 4 : 6),
    [kind, unsaturated]
  );
  const marks = useMemo(
    () => crowdMarksOf(kind, crowd, narrow),
    [crowd, kind, narrow]
  );
  return (
    <group>
      <group
        position={[asideOf(kind, narrow), MIDDLE, 0]}
        scale={frameOf(narrow).crowd}
      >
        <MoleculeModel molecule={crowd} style="spheres" />
        <Water kind={kind} />
      </group>
      {Arr.map(marks, (mark) => (
        <ThreeLabel
          anchorX="left"
          color={ink}
          fontSize={narrow ? "compact" : "annotation"}
          key={mark.part}
          position={mark.at}
        >
          {parts[mark.part]}
        </ThreeLabel>
      ))}
    </group>
  );
}

/** The water around a crowd of lipids: real water molecules where the crowd lets them be. */
function Water({ kind }: { readonly kind: Molecule }) {
  const playing = useVisualScene((card) => card.playing, false);
  return (
    <group>
      {Arr.map(poolsOf(kind), (pool, index) => (
        <group
          key={Arr.join(Arr.map(pool, String), ":")}
          position={pool}
          rotation={[index * 1.3, index * 2.1, index * 0.7]}
        >
          <Solvent count={16} inner={0} outer={12} playing={playing} />
        </group>
      ))}
    </group>
  );
}
