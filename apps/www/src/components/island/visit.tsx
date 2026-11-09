"use client";

import { ArrowLeft01Icon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import type { Edit } from "@repo/backend/confect/island/world";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useRouter } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import { panelVariants } from "@/components/island/panel";
import IslandView from "@/components/island/view";
import { useCurrentLocale } from "@/lib/routing/link";

/**
 * Another learner's island on the whole screen (ADR 0047, D18): their world as
 * the game's renderer draws it, slowly circled, with their address and level
 * and the way back. A closed island says so instead.
 */
export default function IslandVisit({
  island,
  username,
}: {
  island: {
    readonly edits: readonly Edit[];
    readonly level: number;
    readonly seed: number;
    readonly size: number;
  } | null;
  username: string;
}) {
  const t = useTranslations("Island");
  const locale = useCurrentLocale();
  const router = useRouter();
  return (
    <div className="fixed inset-0 overflow-hidden bg-[linear-gradient(#58a6e4,#bfe2f0)] text-[#3b2414]">
      {island === null ? null : (
        <IslandView
          edits={island.edits}
          seed={island.seed}
          size={island.size}
        />
      )}
      <header className="absolute inset-x-0 top-0 flex p-[max(0.75rem,env(safe-area-inset-top))_max(0.75rem,env(safe-area-inset-right))_0_max(0.75rem,env(safe-area-inset-left))]">
        <div
          className={panelVariants({
            className: "flex items-center gap-2 p-1.5 pr-3",
          })}
        >
          <button
            aria-label={t("leave")}
            className="grid size-9 cursor-pointer place-items-center border-2 border-[#7a4a26] bg-[#e9c992] outline-none hover:bg-[#f0d6a6] focus-visible:border-[#fff3c4] sm:size-12"
            onClick={() => {
              if (router.history.canGoBack()) {
                router.history.back();
                return;
              }
              router.navigate({ params: { locale }, to: "/$locale/home" });
            }}
            title={t("leave")}
            type="button"
          >
            <HugeIcons className="size-5" icon={ArrowLeft01Icon} />
          </button>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-sm font-semibold">
              {t("visit-title", { name: username })}
            </h1>
            {island === null ? null : (
              <p className="text-sm text-[#6b4426]">
                {t("level", { level: island.level })}
              </p>
            )}
          </div>
        </div>
      </header>
      {island === null ? (
        <p
          className={panelVariants({
            className:
              "absolute top-1/2 left-1/2 flex max-w-xs -translate-x-1/2 -translate-y-1/2 items-center gap-2 px-4 py-3 text-sm",
          })}
        >
          <HugeIcons className="size-5 shrink-0" icon={SquareLock02Icon} />
          {t("visit-closed")}
        </p>
      ) : null}
    </div>
  );
}
