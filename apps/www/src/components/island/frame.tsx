import {
  DropletIcon,
  RotateLeft01Icon,
  RotateRight01Icon,
  Share08Icon,
  VolumeHighIcon,
} from "@hugeicons/core-free-icons";
import { growthOf } from "@repo/backend/confect/island/level";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardMenu,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { lazy } from "@repo/design-system/lib/lazy";
import { Option } from "effect";
import { Suspense, useState } from "react";
import { useTranslations } from "use-intl";
import { BuildBand, BuildToggle } from "@/components/island/build";
import { useWaterIsland } from "@/components/island/farm";
import { useShareIsland } from "@/components/island/share";
import { SkyProvider } from "@/components/island/sky";
import { SoundProvider, useSoundSwitch } from "@/components/island/sound";
import { ToolsProvider } from "@/components/island/tools";
import { useIsland } from "@/lib/island/context";

/** The island's canvas and three.js, loaded only when the frame renders (ADR 0042, D14). */
const IslandCanvas = lazy(() => import("@/components/island/canvas"));

/** Waters the owner's garden: one press a day, on a day they learned (ADR 0042, D13). */
function WaterItem() {
  const t = useTranslations("Island");
  const water = useWaterIsland();
  return (
    <DropdownMenuItem icon={DropletIcon} onClick={water}>
      {t("water")}
    </DropdownMenuItem>
  );
}

/** Shares the owner's island with anyone who has the link (ADR 0042, D20). */
function ShareItem() {
  const t = useTranslations("Island");
  const share = useShareIsland();
  return (
    <DropdownMenuItem icon={Share08Icon} onClick={share}>
      {t("share")}
    </DropdownMenuItem>
  );
}

/** The island's one sound switch: music, ambience and cues together (ADR 0042, D26). */
function SoundItem() {
  const t = useTranslations("Island");
  const { flip, on } = useSoundSwitch();
  return (
    <DropdownMenuCheckboxItem
      checked={on}
      icon={VolumeHighIcon}
      onCheckedChange={flip}
    >
      {t("sound")}
    </DropdownMenuCheckboxItem>
  );
}

/** What the owner can spend, what the next level asks for, and the badges they earned. */
function IslandFacts() {
  const t = useTranslations("Island");
  const { badges, owner } = useIsland();
  if (Option.isNone(owner)) {
    return <VisualFactTabular label={t("badges")} value={badges} />;
  }
  const { lifetime, materials, stars } = owner.value;
  return (
    <>
      <VisualFactTabular label={t("stars")} value={stars} />
      <VisualFactTabular
        label={t("materials")}
        value={t("materials-value", materials)}
      />
      <VisualFactTabular
        label={t("next")}
        value={Option.match(growthOf(lifetime).next, {
          onNone: () => t("top"),
          onSome: (next) => t("next-value", { stars: next - lifetime }),
        })}
      />
      <VisualFactTabular label={t("badges")} value={badges} />
    </>
  );
}

/**
 * An island in a visual card, drawn from the surrounding `IslandContext`: its
 * name and level, the island itself edge to edge, building as the owner's main
 * action, full screen and a menu that waters and shares the owner's island,
 * turns it a quarter left or right (open while the reader turns, so each turn
 * takes one press) and switches its sound. The footer shows the owner what
 * they can spend and the next level, and a visitor the badges. The canvas loads
 * with the frame and holds nothing in its place until then, since no picture of
 * the island would be the truth before it draws; the camera comes down from
 * the sky as it opens.
 */
export function IslandFrame({
  name,
}: {
  /** The owner's name, missing only when the account could not be read. */
  name: string | undefined;
}) {
  const t = useTranslations("Island");
  const [turn, setTurn] = useState(0);
  const { level, owner } = useIsland();
  const own = Option.isSome(owner);
  return (
    <ToolsProvider>
      <SkyProvider>
        <SoundProvider>
          <section className="motion-safe:[view-transition-name:island]">
            <VisualCard>
              <VisualCardHeader
                description={t("level", { level })}
                title={name === undefined ? t("title") : t("name", { name })}
              />
              <BuildBand />
              <VisualCardBody className="aspect-square sm:aspect-video">
                <Suspense fallback={null}>
                  <IslandCanvas descend turn={turn} />
                </Suspense>
              </VisualCardBody>
              <VisualCardActions>
                {own ? <BuildToggle /> : null}
                <VisualCardMenu>
                  {own ? <WaterItem /> : null}
                  {own ? <ShareItem /> : null}
                  <DropdownMenuItem
                    closeOnClick={false}
                    icon={RotateLeft01Icon}
                    onClick={() => setTurn((current) => (current + 3) % 4)}
                  >
                    {t("turn-left")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    closeOnClick={false}
                    icon={RotateRight01Icon}
                    onClick={() => setTurn((current) => (current + 1) % 4)}
                  >
                    {t("turn-right")}
                  </DropdownMenuItem>
                  <SoundItem />
                </VisualCardMenu>
              </VisualCardActions>
              <VisualCardFooter>
                <VisualCardFacts>
                  <IslandFacts />
                </VisualCardFacts>
              </VisualCardFooter>
            </VisualCard>
          </section>
        </SoundProvider>
      </SkyProvider>
    </ToolsProvider>
  );
}
