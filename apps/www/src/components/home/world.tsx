import { PlayIcon } from "@hugeicons/core-free-icons";
import type { Edit } from "@repo/backend/confect/island/world";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { AfterPageRead } from "@repo/design-system/components/ui/settled";
import { lazy } from "@repo/design-system/lib/lazy";
import { Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { useTranslations } from "use-intl";
import { panelVariants } from "@/components/island/panel";
import { useCurrentLocale } from "@/lib/routing/link";

/** The island's renderer, loaded once the reader is on the page (ADR 0039, D4). */
const IslandView = lazy(() => import("@/components/island/view"));

/**
 * The learner's island at the top of their home (ADR 0047): the world itself,
 * drawn by the game's renderer as a camera slowly circles it, in the game's
 * own frame, with their level, the Stars to the next one, and the way in.
 * The whole window enters the game, so a phone needs no small target.
 */
export function HomeWorld({
  island,
}: {
  island: {
    readonly edits: readonly Edit[];
    readonly level: number;
    readonly lifetime: number;
    readonly next: number | undefined;
    readonly seed: number;
    readonly size: number;
  };
}) {
  const t = useTranslations("Island");
  const locale = useCurrentLocale();
  return (
    <Link
      aria-label={t("play")}
      className={panelVariants({
        className:
          "group relative block aspect-4/3 overflow-hidden bg-[linear-gradient(#58a6e4,#bfe2f0)] outline-none focus-visible:ring-4 focus-visible:ring-[#ffe9a8] sm:aspect-video",
      })}
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
      <span className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
        <span
          className={panelVariants({
            className: "flex flex-col gap-0.5 px-3 py-2",
          })}
        >
          <span className="text-sm font-semibold">
            {t("level", { level: island.level })}
          </span>
          <span className="text-xs text-[#6b4426]">
            {island.next === undefined
              ? t("top")
              : t("next", {
                  level: island.level + 1,
                  stars: island.next - island.lifetime,
                })}
          </span>
        </span>
        <span
          className={panelVariants({
            className:
              "flex items-center gap-2 bg-[#ffe9a8] px-4 py-3 font-semibold transition-transform group-hover:-translate-y-0.5 group-active:translate-y-px",
          })}
        >
          <HugeIcons className="size-5" icon={PlayIcon} />
          {t("play")}
        </span>
      </span>
    </Link>
  );
}
