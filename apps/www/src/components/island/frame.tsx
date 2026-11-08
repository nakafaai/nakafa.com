import {
  RotateLeft01Icon,
  RotateRight01Icon,
} from "@hugeicons/core-free-icons";
import { growthOf } from "@repo/backend/confect/island/level";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
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
import { ToolsProvider } from "@/components/island/tools";
import { useIsland } from "@/lib/island/context";

/** The island's canvas and three.js, loaded only when the frame renders (ADR 0042, D14). */
const IslandCanvas = lazy(() => import("@/components/island/canvas"));

/**
 * The owner's island in a visual card, drawn from the surrounding
 * `IslandContext`: its name and level, the island itself
 * edge to edge, full screen and a menu that turns it a quarter left or right
 * (open while the owner turns, so each turn takes one press), and what
 * the owner can spend and the Stars the next level asks for. The canvas loads
 * with the frame and holds nothing in its place until then, since no picture of
 * the island would be the truth before it draws.
 */
export function IslandFrame({
  lifetime,
  name,
  stars,
}: {
  lifetime: number;
  /** The owner's name, missing only when the account could not be read. */
  name: string | undefined;
  stars: number;
}) {
  const t = useTranslations("Island");
  const [turn, setTurn] = useState(0);
  const growth = growthOf(lifetime);
  const { owner } = useIsland();
  return (
    <ToolsProvider>
      <VisualCard>
        <VisualCardHeader
          description={t("level", { level: growth.level })}
          title={name === undefined ? t("title") : t("name", { name })}
        />
        <BuildBand />
        <VisualCardBody className="aspect-square sm:aspect-video">
          <Suspense fallback={null}>
            <IslandCanvas turn={turn} />
          </Suspense>
        </VisualCardBody>
        <VisualCardActions>
          {Option.isSome(owner) ? <BuildToggle /> : null}
          <VisualCardMenu>
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
          </VisualCardMenu>
        </VisualCardActions>
        <VisualCardFooter>
          <VisualCardFacts>
            <VisualFactTabular label={t("stars")} value={stars} />
            <VisualFactTabular
              label={t("next")}
              value={Option.match(growth.next, {
                onNone: () => t("top"),
                onSome: (next) => t("next-value", { stars: next - lifetime }),
              })}
            />
          </VisualCardFacts>
        </VisualCardFooter>
      </VisualCard>
    </ToolsProvider>
  );
}
