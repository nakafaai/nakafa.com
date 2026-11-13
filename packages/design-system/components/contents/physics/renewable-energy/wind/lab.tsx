import {
  fade,
  gradientRect,
  litBall,
  mix,
  vignette,
  withShadow,
} from "@repo/design-system/components/contents/physics/canvas/paint";
import {
  paintClouds,
  paintHills,
  paintSky,
} from "@repo/design-system/components/contents/physics/renewable-energy/scenery/outdoor";
import {
  dailyEnergy,
  rotorSpeed,
  SITE_WIND,
  type Site,
  SiteSchema,
  turbinePower,
  windPower,
} from "@repo/design-system/components/contents/physics/renewable-energy/wind/site";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";
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
import { P5Sketch } from "@repo/design-system/components/visual/sketch";
import { getColor } from "@repo/design-system/lib/color";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr, Schema } from "effect";
import type p5 from "p5";
import { type ReactNode, useState } from "react";

/** How much of the scene's width the wind crosses each second at 1 m/s. */
const STREAK_PACE = 0.012;

/** What the sketch reads on every frame: the site the turbine stands at. */
const WindFrameSchema = Schema.Struct({ site: SiteSchema });
type WindFrame = typeof WindFrameSchema.Type;

/** The land under the turbine: a valley floor, a hill top, or a beach with the sea behind. */
function paintSite(sketch: p5, site: Site, ground: number) {
  const { height, width } = sketch;
  if (site === "coast") {
    gradientRect(sketch, { height: height - ground, width, x: 0, y: ground }, [
      [0, mix(MATERIAL.water, MATERIAL.waterGlint, 0.45)],
      [1, mix(MATERIAL.water, getColor("BLACK"), 0.4)],
    ]);
    sketch.fill(MATERIAL.sand);
    sketch.quad(
      0,
      ground + height * 0.04,
      width * 0.62,
      ground + height * 0.02,
      width * 0.7,
      height,
      0,
      height
    );
    return ground + height * 0.03;
  }
  const top = site === "hill" ? ground - height * 0.22 : ground + height * 0.04;
  gradientRect(sketch, { height: height - ground, width, x: 0, y: ground }, [
    [0, MATERIAL.grass],
    [1, MATERIAL.foliageDark],
  ]);
  if (site === "hill") {
    sketch.fill(mix(MATERIAL.grass, getColor("WHITE"), 0.08));
    sketch.beginShape();
    sketch.vertex(width * 0.05, ground + 2);
    for (let step = 0; step <= 20; step += 1) {
      const share = step / 20;
      sketch.vertex(
        width * (0.05 + share * 0.7),
        ground - Math.sin(share * Math.PI) * (ground - top)
      );
    }
    sketch.vertex(width * 0.75, ground + 2);
    sketch.endShape(sketch.CLOSE);
  }
  if (site === "valley") {
    sketch.fill(mix(MATERIAL.foliageDark, MATERIAL.skyHaze, 0.25));
    sketch.triangle(
      -width * 0.1,
      ground,
      width * 0.18,
      ground - height * 0.35,
      width * 0.4,
      ground
    );
    sketch.triangle(
      width * 0.62,
      ground,
      width * 0.88,
      ground - height * 0.4,
      width * 1.15,
      ground
    );
  }
  return top;
}

/** The turbine: tower, nacelle and three blades turned to `angle`. */
function paintTurbine(
  sketch: p5,
  base: { x: number; y: number },
  tall: number,
  angle: number
) {
  const hub = { x: base.x, y: base.y - tall };
  withShadow(
    sketch,
    { blur: 12, color: fade(getColor("BLACK"), 0.45), drop: 5 },
    () => {
      sketch.fill(getColor("SLATE", 200));
      sketch.quad(
        base.x - tall * 0.03,
        base.y,
        base.x + tall * 0.03,
        base.y,
        base.x + tall * 0.015,
        hub.y,
        base.x - tall * 0.015,
        hub.y
      );
    }
  );
  gradientRect(
    sketch,
    {
      height: tall * 0.06,
      width: tall * 0.16,
      x: hub.x - tall * 0.02,
      y: hub.y - tall * 0.03,
    },
    [
      [0, getColor("WHITE")],
      [1, getColor("SLATE", 300)],
    ]
  );
  const blade = tall * 0.62;
  for (let index = 0; index < 3; index += 1) {
    const turn = angle + (index * Math.PI * 2) / 3;
    const tip = {
      x: hub.x + Math.cos(turn) * blade,
      y: hub.y + Math.sin(turn) * blade,
    };
    const side = {
      x: -Math.sin(turn) * tall * 0.035,
      y: Math.cos(turn) * tall * 0.035,
    };
    sketch.fill(mix(getColor("WHITE"), getColor("SLATE", 300), 0.25));
    sketch.quad(
      hub.x + side.x,
      hub.y + side.y,
      tip.x + side.x * 0.2,
      tip.y + side.y * 0.2,
      tip.x,
      tip.y,
      hub.x - side.x * 0.3,
      hub.y - side.y * 0.3
    );
  }
  litBall(sketch, hub, tall * 0.035, {
    dark: getColor("SLATE", 400),
    light: getColor("WHITE"),
  });
}

/** Streaks of moving air that cross the scene at the site's wind speed. */
function paintWind(sketch: p5, speed: number, time: number) {
  const { height, width } = sketch;
  sketch.stroke(fade(getColor("WHITE"), 0.55));
  sketch.strokeWeight(1.5);
  for (let streak = 0; streak < 14; streak += 1) {
    const seed = Math.sin(streak * 91.7) * 43_758.5453;
    const lane = seed - Math.floor(seed);
    const x =
      ((lane * 3 + time * speed * STREAK_PACE * (0.8 + lane * 0.4)) % 1.2) *
        width -
      width * 0.1;
    const y = height * (0.12 + lane * 0.5);
    sketch.line(x, y, x + width * 0.004 * speed * 3, y);
  }
  sketch.noStroke();
}

/** Draws the turbine at its site, its rotor turning at the true speed the wind gives it. */
function windProgram(sketch: p5, read: () => WindFrame) {
  let time = 0;
  let angle = 0;
  sketch.setup = () => {
    sketch.createCanvas(1, 1);
    sketch.noStroke();
  };
  sketch.draw = () => {
    const { site } = read();
    const elapsed = sketch.isLooping()
      ? Math.min(sketch.deltaTime / 1000, 0.1)
      : 0;
    time += elapsed;
    angle += elapsed * rotorSpeed(site);
    const { height, width } = sketch;
    const ground = height * 0.8;
    paintSky(sketch, ground);
    paintClouds(sketch, ground, time * SITE_WIND[site] * 0.6);
    paintHills(sketch, ground);
    const base = paintSite(sketch, site, ground);
    paintTurbine(sketch, { x: width * 0.4, y: base }, height * 0.48, angle);
    paintWind(sketch, SITE_WIND[site], time);
    vignette(sketch, 0.3);
  };
}

interface WindRotorLabProps {
  description: ReactNode;
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
  title: ReactNode;
}

/**
 * The same wind turbine, rotor 40 m long, at a valley, a hill top and a
 * coast. The wind through the rotor carries ½ ρ A v³, so the coast's 8 m/s
 * gives eight times the power of the valley's 4 m/s, and the rotor turns at
 * the true speed each wind gives it.
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
    <VisualCard>
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
      <VisualCardBody aria-label={labels.viewLabel} render={<section />}>
        <P5Sketch
          label={labels.viewLabel}
          program={windProgram}
          state={{ site }}
        />
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
