import { Badge } from "@repo/design-system/components/ui/badge";
import { AfterPageRead } from "@repo/design-system/components/ui/settled";
import { lazy } from "@repo/design-system/lib/lazy";
import { Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { useTranslations } from "use-intl";
import { useProgress } from "@/components/progress/context";
import { useCurrentLocale } from "@/lib/routing/link";

/** The island's renderer, loaded once the reader is on the page (ADR 0039, D4). */
const IslandView = lazy(() => import("@/components/island/view"));

/**
 * The learner's world as a card (ADR 0047, D27): the island itself, drawn by
 * the game's renderer as a camera slowly circles it, with its level. The whole
 * card enters the game.
 */
export function WorldCard() {
  const t = useTranslations("Island");
  const locale = useCurrentLocale();
  const { island } = useProgress();
  return (
    <Link
      aria-label={t("play")}
      className="ring-foreground/10 focus-visible:ring-ring relative block aspect-4/3 overflow-hidden rounded-xl bg-[linear-gradient(#58a6e4,#bfe2f0)] ring-1 outline-none focus-visible:ring-3"
      params={{ locale }}
      to="/$locale/island"
    >
      <AfterPageRead>
        <Suspense fallback={null}>
          <IslandView
            edits={island.edits}
            seed={island.seed}
            size={island.size}
          />
        </Suspense>
      </AfterPageRead>
      <Badge className="absolute top-3 left-3" variant="secondary">
        {t("level", { level: island.level })}
      </Badge>
    </Link>
  );
}
