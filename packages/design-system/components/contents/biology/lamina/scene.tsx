import { useFrame, useThree } from "@react-three/fiber";
import type { LeafLayer } from "@repo/design-system/components/contents/biology/lamina/model";
import { leafLayerSpec } from "@repo/design-system/components/contents/biology/lamina/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { Blobs } from "@repo/design-system/components/three/flora/blobs";
import {
  growLamina,
  LAYERS,
} from "@repo/design-system/components/three/flora/mesophyll";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { FLORA_COLORS } from "@repo/design-system/lib/material/flora";
import { FOLIAGE_COLORS } from "@repo/design-system/lib/material/foliage";
import { useEffect, useMemo, useRef } from "react";
import type { Group } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** The block of leaf blade the lab cuts out: a vein through its middle and a stoma to one side of it. */
const BLOCK = { depth: 0.8, seed: 3, stoma: 0.4, vein: 0.2, width: 1.64 };

function LaminaCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0.4, 1.1, 3.2] : [0.3, 0.95, 2.55]}
      cameraTarget={[0, 0.68, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.3}
    />
  );
}

export function LeafLaminaScene({
  activeLayer,
  parts,
}: {
  readonly activeLayer: LeafLayer;
  readonly parts: Readonly<
    Record<
      "airSpace" | "chloroplast" | "guardCell" | "phloem" | "xylem",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const specimenRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const focus = leafLayerSpec(activeLayer);
  const leaf = useMemo(() => growLamina(BLOCK), []);
  const film = useMemo(
    () =>
      new RoundedBoxGeometry(
        BLOCK.width + 0.01,
        LAYERS.top - LAYERS.cuticle,
        BLOCK.depth + 0.01,
        3,
        0.016
      ),
    []
  );
  useEffect(() => () => film.dispose(), [film]);

  useFrame((_, delta) => {
    if (!playing || specimenRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.45;
    specimenRef.current.rotation.y = Math.sin(phaseRef.current) * 0.18;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <LaminaCamera />
      <group ref={specimenRef}>
        {/* The waxy cuticle: a clear film over the upper face */}
        <mesh castShadow position={[0, (LAYERS.cuticle + LAYERS.top) / 2, 0]}>
          <primitive attach="geometry" object={film} />
          <meshPhysicalMaterial
            clearcoat={1}
            clearcoatRoughness={0.06}
            color={FLORA_COLORS.cuticleWax}
            opacity={activeLayer === "cuticle" ? 0.92 : 0.62}
            roughness={0.12}
            transparent
          />
        </mesh>
        <Blobs
          blobs={leaf.upper}
          deep={FLORA_COLORS.epidermisDeep}
          faded={activeLayer !== "upperEpidermis"}
          gloss={0.6}
          shape="box"
          sun={FLORA_COLORS.epidermisPale}
        />
        <Blobs
          blobs={leaf.palisade}
          deep={FLORA_COLORS.palisadeDeep}
          faded={activeLayer !== "palisade"}
          shape="pill"
          sun={FLORA_COLORS.palisadePale}
        />
        <Blobs
          blobs={leaf.spongy}
          deep={FLORA_COLORS.spongyDeep}
          faded={activeLayer !== "spongy"}
          shape="ball"
          sun={FLORA_COLORS.spongyPale}
        />
        <Blobs
          blobs={leaf.plastids}
          deep={FLORA_COLORS.plastidDeep}
          gloss={0.7}
          shape="ball"
          sun={FLORA_COLORS.plastidPale}
        />
        <Blobs
          blobs={leaf.sheath}
          deep={FLORA_COLORS.sheathDeep}
          faded={activeLayer !== "vascular"}
          shape="tube"
          sun={FLORA_COLORS.sheathPale}
        />
        <Blobs
          blobs={leaf.xylem}
          deep={FLORA_COLORS.xylemDeep}
          faded={activeLayer !== "vascular"}
          shape="tube"
          sun={FLORA_COLORS.xylemPale}
        />
        <Blobs
          blobs={leaf.bores}
          deep={FLORA_COLORS.boreDark}
          gloss={0}
          shape="tube"
          sun={FLORA_COLORS.boreDark}
        />
        <Blobs
          blobs={leaf.phloem}
          deep={FLORA_COLORS.phloemDeep}
          faded={activeLayer !== "vascular"}
          shape="tube"
          sun={FLORA_COLORS.phloemPale}
        />
        <Blobs
          blobs={leaf.lower}
          deep={FLORA_COLORS.epidermisDeep}
          faded={activeLayer !== "lowerEpidermis"}
          gloss={0.6}
          shape="box"
          sun={FLORA_COLORS.epidermisPale}
        />
        <Blobs
          blobs={leaf.guards}
          deep={FLORA_COLORS.guardDeep}
          faded={activeLayer !== "stoma"}
          gloss={0.6}
          shape="ball"
          sun={FLORA_COLORS.guardPale}
        />

        {/* Focus height marker */}
        <mesh position={[-0.92, focus.focusY, 0]}>
          <sphereGeometry args={[0.045, 12, 10]} />
          <meshStandardMaterial
            color={FOLIAGE_COLORS.scanRing}
            roughness={0.32}
          />
        </mesh>

        {/* Anatomical callouts */}
        <ThreeLabel
          color={FOLIAGE_COLORS.labelInk}
          fontSize="compact"
          position={[0.9, 0.82, 0.42]}
        >
          <span>{parts.chloroplast}</span>
        </ThreeLabel>
        <ThreeLabel
          color={FOLIAGE_COLORS.labelInk}
          fontSize="compact"
          position={[-0.88, 0.42, 0.42]}
        >
          <span>{parts.airSpace}</span>
        </ThreeLabel>
        <ThreeLabel
          color={FOLIAGE_COLORS.labelInk}
          fontSize="compact"
          position={[0.22, 0.66, 0.44]}
        >
          <span>{parts.xylem}</span>
        </ThreeLabel>
        <ThreeLabel
          color={FOLIAGE_COLORS.labelInk}
          fontSize="compact"
          position={[0.22, 0.46, 0.44]}
        >
          <span>{parts.phloem}</span>
        </ThreeLabel>
        <ThreeLabel
          color={FOLIAGE_COLORS.labelInk}
          fontSize="compact"
          position={[BLOCK.stoma, 0.02, 0.44]}
        >
          <span>{parts.guardCell}</span>
        </ThreeLabel>
      </group>
    </group>
  );
}
