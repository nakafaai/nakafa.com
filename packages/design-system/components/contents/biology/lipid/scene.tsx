import { useFrame } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  crowdOf,
  layoutOf,
  MIDDLE,
  poolsOf,
} from "@repo/design-system/components/contents/biology/lipid/layout";
import type {
  Chain,
  Molecule,
  Scale,
} from "@repo/design-system/components/contents/biology/lipid/packing";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MoleculeModel } from "@repo/design-system/components/three/molecule/kit";
import { Solvent } from "@repo/design-system/components/three/molecule/solvent";
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

/**
 * The lipid lab's scene. One molecule is a ball and stick model with every
 * atom, in the water it meets: glycerol, the ester bonds, eighteen-carbon
 * fatty acids that run straight when saturated and kink at a cis double bond
 * when not, and the phosphate and choline head of a membrane lipid. Many
 * molecules in water are a space-filling model of their heavy atoms: a clump
 * of fat that hides its tails from the water, or a patch of bilayer with its
 * heads out and its tails in. The camera frames the atoms and their labels,
 * whatever the shape of the frame; the water is left out of that fit.
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
  const ink = useLabelInk();
  const rootRef = useRef<Group>(null);
  const clock = useRef(0);
  const unsaturated = chain === "unsaturated";
  const subject = useMemo(
    () =>
      scale === "molecule"
        ? layoutOf(molecule, unsaturated)
        : crowdOf(molecule, unsaturated),
    [molecule, scale, unsaturated]
  );

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
        cameraPosition={[0, 0.9, 2.18]}
        cameraTarget={[0, MIDDLE, 0]}
        fov={38}
        framing="content"
      />
      <group ref={rootRef}>
        <group position={subject.stand} scale={subject.scale}>
          <CameraBounds bounds={subject.bounds}>
            <MoleculeModel
              molecule={subject.molecule}
              style={scale === "molecule" ? "sticks" : "spheres"}
            />
          </CameraBounds>
          <CameraBounds exclude>
            {scale === "molecule" ? (
              <group position={[-16, -8, -28]}>
                <Solvent count={26} inner={12} outer={20} playing={playing} />
              </group>
            ) : (
              <Water kind={molecule} />
            )}
          </CameraBounds>
        </group>
        {Arr.map(subject.marks, (mark) => (
          <ThreeLabel
            anchorX="left"
            color={ink}
            fontSize="compact"
            key={mark.part}
            position={mark.at}
          >
            {parts[mark.part]}
          </ThreeLabel>
        ))}
      </group>
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
