import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { Sex } from "@repo/design-system/components/contents/biology/gametogenesis/division";
import {
  cellForms,
  follicles,
  germCells,
  leydigCells,
  leydigForms,
  ovaryForms,
  spermTails,
  tailForms,
  testisForms,
} from "@repo/design-system/components/contents/biology/gametogenesis/gonad";
import {
  femaleForms,
  fimbriae,
  fimbriaForms,
  maleForms,
} from "@repo/design-system/components/contents/biology/gametogenesis/tract";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Body, Tuft } from "@repo/design-system/components/three/organism/body";
import { Skin } from "@repo/design-system/components/three/organism/skin";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";

export type AnatomyPart =
  | "testis"
  | "scrotum"
  | "epididymis"
  | "spermDuct"
  | "seminalVesicle"
  | "prostate"
  | "cowper"
  | "urethra"
  | "penis"
  | "ovary"
  | "oviduct"
  | "uterus"
  | "cervix"
  | "vagina"
  | "tubule"
  | "interstitial"
  | "follicle"
  | "corpusLuteum"
  | "head"
  | "acrosome"
  | "middle"
  | "tail"
  | "follicular"
  | "antrum";

const FIMBRIAE = fimbriae(14);
const GERM_CELLS = germCells();
const SPERM_TAILS = spermTails();
const LEYDIG_CELLS = leydigCells();
const FOLLICLES = follicles();

/** The wet, living surface of an organ: glossy with fluid, and warm where light passes through it. */
function OrganSkin() {
  return (
    <Skin
      bump={0.5}
      flesh={BIOLOGY_COLORS.tissueDeep}
      glow={0.35}
      repeat={[6, 3]}
      roughness={0.5}
      surface="mucosa"
      wet={0.7}
    />
  );
}

/** The surface of a cut face of tissue, or of one cell in it: moist, finely grained and soft. */
function SectionSkin() {
  return (
    <Skin
      bump={0.35}
      flesh={BIOLOGY_COLORS.tissuePink}
      glow={0.3}
      repeat={[3, 3]}
      roughness={0.55}
      surface="mucosa"
      wet={0.55}
    />
  );
}

/** The male and female reproductive tracts as anatomical models at the scale of the organ system. */
export function SystemView({
  parts,
  sex,
}: {
  readonly parts: Readonly<Record<AnatomyPart, string>>;
  readonly sex: Sex;
}) {
  const ink = useLabelInk();

  if (sex === "male") {
    return (
      <group>
        <Body shape={maleForms}>
          <OrganSkin />
        </Body>
        <ThreeLabel
          anchorY="top"
          color={ink}
          fontSize="compact"
          gap={0.04}
          position={[-0.34, 0.1, 0]}
        >
          {parts.testis}
        </ThreeLabel>
        <ThreeLabel
          anchorY="bottom"
          color={ink}
          fontSize="compact"
          gap={0.04}
          position={[-0.12, 0.9, 0]}
        >
          {parts.spermDuct}
        </ThreeLabel>
        <ThreeLabel
          anchorX="left"
          color={ink}
          fontSize="compact"
          gap={0.04}
          position={[0.25, 0.57, 0]}
        >
          {parts.prostate}
        </ThreeLabel>
        <ThreeLabel
          anchorY="bottom"
          color={ink}
          fontSize="compact"
          gap={0.04}
          position={[-0.42, 0.58, 0]}
        >
          {parts.urethra}
        </ThreeLabel>
      </group>
    );
  }

  return (
    <group>
      <Body shape={femaleForms}>
        <OrganSkin />
      </Body>
      <Tuft placements={FIMBRIAE} shape={fimbriaForms}>
        <OrganSkin />
      </Tuft>
      <ThreeLabel
        anchorY="top"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[0.56, 0.52, 0.05]}
      >
        {parts.ovary}
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[0.44, 0.96, 0]}
      >
        {parts.oviduct}
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[-0.1, 0.5, 0]}
      >
        {parts.uterus}
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[0.1, 0.36, 0]}
      >
        {parts.cervix}
      </ThreeLabel>
    </group>
  );
}

/**
 * A slice of gonad under the microscope: seminiferous tubules lined with
 * germ cells in the testis, or follicles and a corpus luteum in the cut
 * face of an ovary.
 */
export function GonadView({
  parts,
  sex,
}: {
  readonly parts: Readonly<Record<AnatomyPart, string>>;
  readonly sex: Sex;
}) {
  const ink = useLabelInk();

  if (sex === "male") {
    return (
      <group>
        <Body shape={testisForms}>
          <SectionSkin />
        </Body>
        <Tuft placements={GERM_CELLS} shape={cellForms}>
          <SectionSkin />
        </Tuft>
        <Tuft placements={SPERM_TAILS} shape={tailForms}>
          <SectionSkin />
        </Tuft>
        <Tuft placements={LEYDIG_CELLS} shape={leydigForms}>
          <SectionSkin />
        </Tuft>
        <ThreeLabel
          anchorY="bottom"
          color={ink}
          fontSize="compact"
          gap={0.04}
          position={[-0.38, 0.8, 0.07]}
        >
          {parts.tubule}
        </ThreeLabel>
        <ThreeLabel
          anchorY="top"
          color={ink}
          fontSize="compact"
          gap={0.04}
          position={[0.19, 0.4, 0.1]}
        >
          {parts.interstitial}
        </ThreeLabel>
      </group>
    );
  }

  return (
    <group>
      <Body shape={ovaryForms}>
        <SectionSkin />
      </Body>
      <Tuft placements={FOLLICLES} shape={cellForms}>
        <SectionSkin />
      </Tuft>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[-0.44, 0.72, 0.06]}
      >
        {parts.follicle}
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        gap={0.04}
        position={[0.42, 0.68, 0.06]}
      >
        {parts.corpusLuteum}
      </ThreeLabel>
    </group>
  );
}
