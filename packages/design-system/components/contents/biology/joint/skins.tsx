import { Skin } from "@repo/design-system/components/three/organism/skin";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";

/** Living compact bone: matt, finely pitted, and warm where light passes through its thin edges. */
export function BoneSkin() {
  return (
    <Skin
      bump={0.6}
      flesh={SKELETON_COLORS.boneSoft}
      glow={0.12}
      repeat={[6, 3]}
      roughness={1}
      surface="cast"
    />
  );
}

/** Hyaline cartilage: smooth, moist and pearly. */
export function CartilageSkin() {
  return (
    <Skin
      bump={0.12}
      flesh={SKELETON_COLORS.cartilageHyaline}
      glow={0.5}
      repeat={[2, 2]}
      roughness={0.9}
      surface="plastic"
      wet={0.55}
    />
  );
}

/** A tendon, a ligament or a disc: tough, moist cords of fibre with a silky sheen. */
export function CordSkin() {
  return (
    <Skin
      bump={0.3}
      flesh={SKELETON_COLORS.tendonSheen}
      glow={0.45}
      repeat={[3, 3]}
      roughness={1}
      surface="plastic"
      wet={0.3}
    />
  );
}

/** Skeletal muscle under its thin wet sheath. */
export function MuscleSkin() {
  return (
    <Skin
      bump={0.5}
      flesh={SKELETON_COLORS.muscleDark}
      glow={0.15}
      repeat={[4, 4]}
      roughness={1}
      surface="plastic"
      wet={0.22}
    />
  );
}

/** The synovial membrane and the fibrous capsule round it: soft, wet and finely folded. */
export function CapsuleSkin() {
  return (
    <Skin
      bump={0.6}
      flesh={SKELETON_COLORS.synovium}
      glow={0.4}
      repeat={[5, 5]}
      roughness={0.7}
      surface="mucosa"
      wet={0.6}
    />
  );
}

/** Synovial fluid: a clear, slippery, straw-coloured pool. */
export function FluidSkin() {
  return (
    <Skin
      bump={0.1}
      clear={0.4}
      repeat={[1, 1]}
      roughness={0.2}
      surface="plastic"
      wet={1}
    />
  );
}
