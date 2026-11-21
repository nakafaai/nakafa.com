import { useThree } from "@react-three/fiber";
import {
  ANODE_VOLTAGE,
  PLATE_LIMIT,
  spotHeight,
  TUBE,
} from "@repo/design-system/components/contents/chemistry/cathode/beam";
import { ENVELOPE } from "@repo/design-system/components/contents/chemistry/cathode/envelope";
import { CathodeTube } from "@repo/design-system/components/contents/chemistry/cathode/tube";
import { mathNumber } from "@repo/design-system/components/contents/mathematics/number";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import type { ReactNode } from "react";
import { useState } from "react";
import { useFormatter } from "use-intl";

/** The height of the bench under the tube's stand, in centimetres. */
const FLOOR = -3;

/** The words a cathode-ray lab reads from its lesson. */
interface CathodeLabels {
  /** The readout of the voltage that speeds the electrons up. */
  readonly anode: ReactNode;
  /** The readout of the electric field between the plates. */
  readonly field: ReactNode;
  /** The name of the plate-voltage slider and its readout. */
  readonly plates: string;
  /** The readout of how far the glowing spot moved on the screen. */
  readonly spot: ReactNode;
  /** What the scene shows, for assistive technology. */
  readonly view: string;
}

/**
 * Thomson's cathode-ray tube at real size: electrons leave the hot cathode,
 * pass the anode, cross two charged plates, and light a spot on the
 * phosphor screen. Charge the plates and the beam bends toward the positive
 * one, which is how Thomson knew the rays are negative particles. The path is
 * the exact parabola between the plates and a straight line after them.
 */
export function CathodeRayLab({
  description,
  labels,
  title,
}: {
  readonly description: NonNullable<ReactNode>;
  readonly labels: CathodeLabels;
  readonly title: NonNullable<ReactNode>;
}) {
  const format = useFormatter();
  const [plate, setPlate] = useState(100);
  const number = (value: number, digits: number) =>
    mathNumber(format.number(value, "math", { maximumFractionDigits: digits }));

  return (
    <VisualCard onReset={() => setPlate(100)}>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <VisualSlider
          heading={labels.plates}
          label={labels.plates}
          max={PLATE_LIMIT}
          min={-PLATE_LIMIT}
          onValueChange={setPlate}
          readout={<InlineMath math={`${number(plate, 0)}\\ \\mathrm{V}`} />}
          step={10}
          value={plate}
        />
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.view}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={FLOOR} reach={9} setting="lab">
          <CathodeCamera />
          <CathodeTube plate={plate} />
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFact
            label={labels.anode}
            value={
              <InlineMath
                math={`V_a = ${number(ANODE_VOLTAGE, 0)}\\ \\mathrm{V}`}
              />
            }
          />
          <VisualFact
            label={labels.plates}
            value={
              <InlineMath math={`V_p = ${number(plate, 0)}\\ \\mathrm{V}`} />
            }
          />
          <VisualFact
            label={labels.field}
            value={
              <InlineMath
                math={`E = \\dfrac{V_p}{d} = ${number(Math.abs(plate) / (TUBE.gap / 100), 0)}\\ \\mathrm{V/m}`}
              />
            }
          />
          <VisualFact
            label={labels.spot}
            value={
              <InlineMath
                math={`y = ${number(spotHeight(plate), 2)}\\ \\mathrm{cm}`}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** Looks along the tube from the front and a little above, wider on a narrow card. */
function CathodeCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 30 : 22;
  const middle = (ENVELOPE.end + ENVELOPE.apex) / 2;
  return (
    <CameraControls
      cameraPosition={[middle - distance * 0.25, distance * 0.28, distance]}
      cameraTarget={[middle, -0.6, 0]}
      fov={40}
      maxDistance={distance * 1.8}
      minDistance={4}
    />
  );
}
