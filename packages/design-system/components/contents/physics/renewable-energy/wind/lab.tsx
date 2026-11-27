import { WindScene } from "@repo/design-system/components/contents/physics/renewable-energy/wind/scene";
import type { Site } from "@repo/design-system/components/contents/physics/renewable-energy/wind/site";
import {
  dailyEnergy,
  SITE_WIND,
  SiteSchema,
  turbinePower,
  windPower,
} from "@repo/design-system/components/contents/physics/renewable-energy/wind/site";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

interface WindRotorLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    chooseSite: string;
    daily: ReactNode;
    electric: ReactNode;
    sites: Record<Site, ReactNode>;
    speed: ReactNode;
    viewLabel: string;
    wind: ReactNode;
  };
  /** The site the turbine stands at first. */
  site?: Site;
  title: NonNullable<ReactNode>;
}

/**
 * The same wind turbine, rotor 40 m long, at a valley, a hill top and a
 * coast. The wind through the rotor carries ½ ρ A v³, so the coast's 8 m/s
 * gives eight times the power of the valley's 4 m/s, and the rotor turns at
 * the true speed each wind gives it while the air drifts through it at the
 * site's own pace.
 */
export function WindRotorLab({
  description,
  labels,
  site: initialSite = "hill",
  title,
}: WindRotorLabProps) {
  const [site, setSite] = useState<Site>(initialSite);
  const measure = useQuantity();
  const isSite = Schema.is(SiteSchema);

  return (
    <VisualCard
      onReset={() => {
        setSite(initialSite);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseSite}
          gridColumns="3"
          onValueChange={(value) => {
            if (isSite(value)) {
              setSite(value);
            }
          }}
          type="single"
          value={site}
          variant="outline"
        >
          {Arr.map(SiteSchema.literals, (option) => (
            <ToggleGroupItem key={option} value={option}>
              {labels.sites[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage frameloop="always" reach={4.5} setting="field">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[3.6, 1.5, 6.6]}
              cameraTarget={[0, 1.55, 0]}
              fov={36}
              framing="content"
              maxDistance={14}
              maxPolarAngle={Math.PI / 2 - 0.02}
              minDistance={2}
            />
            <WindScene site={site} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.speed}
            value={
              <InlineMath math={measure(SITE_WIND[site], "\\text{ m/s}", 0)} />
            }
          />
          <VisualFactTabular
            label={labels.wind}
            value={
              <InlineMath
                math={measure(windPower(site) / 1000, "\\text{ kW}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.electric}
            value={
              <InlineMath
                math={measure(turbinePower(site) / 1000, "\\text{ kW}", 0)}
              />
            }
          />
          <VisualFactTabular
            label={labels.daily}
            value={
              <InlineMath
                math={measure(dailyEnergy(site), "\\text{ kWh}", 0)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}
