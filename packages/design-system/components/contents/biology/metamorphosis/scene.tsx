import { useFrame, useThree } from "@react-three/fiber";
import {
  buildLaminaGeometry,
  buildStemGeometry,
} from "@repo/design-system/components/contents/biology/botanical";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  useLeafTextures,
  useStemTextures,
} from "@repo/design-system/components/contents/biology/foliage";
import type { Insect } from "@repo/design-system/components/contents/biology/metamorphosis/growth";
import { growthAt } from "@repo/design-system/components/contents/biology/metamorphosis/growth";
import { MetamorphosisOrganism } from "@repo/design-system/components/contents/biology/metamorphosis/stages";
import { OrganicSoilBed } from "@repo/design-system/components/contents/biology/planter";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { SPECIMEN_COLORS } from "@repo/design-system/lib/material/specimen";
import { useEffect, useMemo, useRef } from "react";
import { DoubleSide, Vector3 } from "three";

export type MetamorphosisPart =
  | "exoskeleton"
  | "exuvia"
  | "wingBud"
  | "wing"
  | "headCapsule"
  | "leaf";

function MetamorphosisCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1, 2.75] : [0, 0.82, 2.15]}
      cameraTarget={[0, 0.3, 0.1]}
      fov={38}
      maxDistance={5.5}
      minDistance={1.4}
    />
  );
}

/**
 * 3D insect metamorphosis scene: grounded organic soil bed + woody host twig
 * supporting a sculpted serrated veined milkweed/host leaf, developing insect
 * (egg -> larva/nymph -> hanging chrysalis -> winged adult), shed exuvia during
 * moults. The stepped length record is the chart in the card's footer.
 */
export function MetamorphosisScene({
  insect,
  onTime,
  parts,
  time,
}: {
  readonly insect: Insect;
  readonly onTime: (next: number) => void;
  readonly parts: Readonly<Record<MetamorphosisPart, string>>;
  readonly time: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const ink = useLabelInk();
  const clock = useRef(time);
  const lastSent = useRef(time);
  const leafTex = useLeafTextures("healthy");
  const stemTex = useStemTextures();

  const resetTimeline = () => {
    clock.current = 0;
    lastSent.current = 0;
    onTime(0);
  };

  useVisualStop(resetTimeline);
  useVisualReset(resetTimeline);

  if (!playing) {
    clock.current = time;
    lastSent.current = time;
  }

  useFrame((_, delta) => {
    if (!playing) {
      return;
    }
    clock.current = (clock.current + simulationStep(delta) * 0.1) % 1;
    if (Math.abs(clock.current - lastSent.current) >= 0.015) {
      lastSent.current = clock.current;
      onTime(Math.round(clock.current * 100) / 100);
    }
  });

  const snap = growthAt(insect, time);
  let bodyScale = 0.62 + (snap.lengthMm / 42) * 0.56;
  if (snap.stage === "egg") {
    bodyScale = 0.95;
  } else if (snap.stage === "pupa") {
    bodyScale = 0.96;
  }

  const { hostLeafGeo, hostTwigGeo, petioleGeo } = useMemo(() => {
    // Sculpted curved, organically serrated, deeply veined milkweed/host leaf.
    const leaf = buildLaminaGeometry({
      baseTaper: 0.24,
      cols: 18,
      cup: 0.068,
      droop: 0.075,
      length: 1.34,
      midribCrease: 0.022,
      notchDepth: 0,
      rows: 24,
      ruffleAmp: 0.016,
      ruffleFreq: 6,
      serrationAmp: 0.065,
      serrationTeeth: 12,
      tipPower: 0.7,
      width: 0.68,
    });

    // Organic woody stem rising cleanly out of the dark soil mound on the left.
    const twig = buildStemGeometry(
      [
        new Vector3(-0.62, 0.01, 0.16),
        new Vector3(-0.76, 0.1, 0.2),
        new Vector3(-0.78, 0.19, 0.22),
      ],
      0.044,
      0.024,
      18,
      12
    );

    // Curved tapering petiole blending seamlessly into the leaf's raised underside midrib.
    const petiole = buildStemGeometry(
      [
        new Vector3(-0.8, 0.185, 0.22),
        new Vector3(-0.68, 0.18, 0.22),
        new Vector3(-0.32, 0.215, 0.22),
        new Vector3(0.22, 0.205, 0.22),
      ],
      0.02,
      0.005,
      24,
      8
    );

    return {
      hostLeafGeo: leaf,
      hostTwigGeo: twig,
      petioleGeo: petiole,
    };
  }, []);

  useEffect(
    () => () => {
      hostLeafGeo.dispose();
      hostTwigGeo.dispose();
      petioleGeo.dispose();
    },
    [hostLeafGeo, hostTwigGeo, petioleGeo]
  );

  return (
    <group>
      <SimulationTicker running={playing} />
      <MetamorphosisCamera />

      {/* Seamless horizon-faded organic botanical soil bed (zero floating gray slab) */}
      <OrganicSoilBed
        innerRadius={0.86}
        moundHeight={0.075}
        moundRadius={0.84}
        outerRadius={1.98}
        seed={43}
      />

      {/* Woody host stem twig + curved petiole + sculpted serrated veined host leaf */}
      <mesh castShadow geometry={hostTwigGeo} receiveShadow>
        <SurfaceMaterial
          bump={0.9}
          color={SPECIMEN_COLORS.barkTwigWarm}
          repeat={[2, 2]}
          roughness={0.9}
          surface="bark"
        />
      </mesh>
      <mesh castShadow geometry={petioleGeo}>
        <meshPhysicalMaterial
          bumpMap={stemTex.bumpMap}
          bumpScale={0.01}
          map={stemTex.map}
          roughness={0.52}
        />
      </mesh>
      <mesh
        castShadow
        geometry={hostLeafGeo}
        position={[-0.72, 0.18, 0.22]}
        receiveShadow
        rotation={[0.2, 0, -0.02]}
      >
        <meshPhysicalMaterial
          bumpMap={leafTex.bumpMap}
          bumpScale={0.018}
          clearcoat={0.28}
          clearcoatRoughness={0.36}
          map={leafTex.map}
          roughness={0.5}
          roughnessMap={leafTex.roughnessMap}
          side={DoubleSide}
        />
      </mesh>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.68, 0.38, 0.44]}>
        <span>{parts.leaf}</span>
      </ThreeLabel>

      {/* Sculpted developing insect stage resting cleanly on leaf (or hanging in pupa) */}
      <group
        position={[0, snap.stage === "pupa" ? 0.16 : 0.26, 0.22]}
        scale={bodyScale}
      >
        <MetamorphosisOrganism
          insect={insect}
          instar={snap.instar}
          stage={snap.stage}
        />
      </group>

      {/* Translucent shed exuvia cuticle beside insect during ecdysis */}
      {snap.shedding ? (
        <group position={[-0.46, 0.28, 0.28]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <capsuleGeometry args={[0.042, 0.15, 10, 14]} />
            <meshPhysicalMaterial
              clearcoat={0.55}
              color={BIOLOGY_COLORS.bean}
              opacity={0.44}
              roughness={0.36}
              transparent
            />
          </mesh>
          <ThreeLabel
            anchorY="bottom"
            color={ink}
            gap={0.04}
            position={[0, 0.12, 0]}
          >
            {parts.exuvia}
          </ThreeLabel>
        </group>
      ) : null}
    </group>
  );
}
