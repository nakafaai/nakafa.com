"use client";

import { StarsIcon } from "@hugeicons/core-free-icons";
import type { api } from "@repo/backend/convex/_generated/api";
import {
  AudioPlayerButton,
  AudioPlayerDuration,
  AudioPlayerInitializer,
  AudioPlayerProgress,
  AudioPlayerSpeed,
  AudioPlayerTime,
} from "@repo/design-system/components/ui/audio-player";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { useAi } from "@/components/ai/context/use-ai";
import { usePageTitle } from "@/components/ai/context/use-page-title";

type AudioStudy = NonNullable<
  FunctionReturnType<typeof api.audioStudies.queries.public.getAudioBySlug>
>;

/** Renders the audio player toolbar with a Nina entry action. */
export function SheetAudioToolbar({ data }: { data: AudioStudy }) {
  const t = useTranslations("Ai");

  const audioItem = {
    id: data.audioUrl,
    src: data.audioUrl,
  };

  return (
    <aside className="sticky right-0 bottom-0 left-0 z-50 px-6 pb-6">
      <div className="mx-auto w-full sm:max-w-2xl">
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 text-card-foreground shadow-sm">
          <AudioPlayerInitializer item={audioItem} />

          <div className="flex items-center gap-3">
            <AudioPlayerButton
              className="shrink-0 rounded-full"
              item={audioItem}
              size="icon"
              variant="default"
            />

            <div className="flex shrink-0 items-center gap-1 tabular-nums">
              <AudioPlayerTime />
              <span className="text-muted-foreground">/</span>
              <AudioPlayerDuration />
            </div>

            <div className="min-w-0 flex-1">
              <AudioPlayerProgress className="w-full" />
            </div>

            <div className="flex items-center">
              <Tooltip>
                <TooltipTrigger
                  render={<AudioPlayerSpeed size="icon" variant="ghost" />}
                />
                <TooltipContent>
                  <span>{t("speed")}</span>
                </TooltipContent>
              </Tooltip>

              <AskNinaButton />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/** Opens Nina from the compact audio toolbar. */
function AskNinaButton() {
  const contextTitle = usePageTitle();
  const open = useAi((state) => state.open);
  const setContextTitle = useAi((state) => state.setContextTitle);
  const setOpen = useAi((state) => state.setOpen);
  const t = useTranslations("Ai");

  /** Opens Nina with the current page title ready for default suggestions. */
  function handleOpen() {
    setContextTitle(contextTitle || null);
    setOpen(!open);
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button onClick={handleOpen} size="icon" variant="ghost">
            <span className="sr-only">{t("ask-nina")}</span>
            <HugeIcons className="size-4" icon={StarsIcon} />
          </Button>
        }
      />
      <TooltipContent>
        <span>{t("ask-nina")}</span>
      </TooltipContent>
    </Tooltip>
  );
}
