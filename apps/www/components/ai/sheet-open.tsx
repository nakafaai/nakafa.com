"use client";

import {
  ArrowUpRight01Icon,
  SparklesIcon,
  StarsIcon,
} from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type {
  ContentType,
  Locale,
} from "@repo/backend/convex/lib/validators/contents";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import {
  AudioPlayerButton,
  AudioPlayerDuration,
  AudioPlayerInitializer,
  AudioPlayerProgress,
  AudioPlayerProvider,
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
import { cleanSlug } from "@repo/utilities/helper";
import type { FunctionReturnType } from "convex/server";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useAi } from "@/lib/context/use-ai";

const SLIDE_DISTANCE = 200;

interface Props {
  audio?: {
    contentType: Extract<ContentType, "article" | "subject">;
    locale: Locale;
    slug: string;
  };
}

export function AiSheetOpen({ audio }: Props) {
  const { data, isPending } = useQueryWithStatus(
    api.audioStudies.public.queries.getAudioBySlug,
    audio
      ? {
          slug: cleanSlug(audio.slug),
          locale: audio.locale,
          contentType: audio.contentType,
        }
      : "skip"
  );

  if (isPending) {
    return null;
  }

  if (!data) {
    return <AiSheet />;
  }

  return (
    <AudioPlayerProvider>
      <AiToolbar data={data} />
    </AudioPlayerProvider>
  );
}

function AiToolbar({
  data,
}: {
  data: NonNullable<
    FunctionReturnType<typeof api.audioStudies.public.queries.getAudioBySlug>
  >;
}) {
  const t = useTranslations("Ai");

  const audioItem = {
    id: data.audioUrl,
    src: data.audioUrl,
  };

  return (
    <aside className="sticky right-0 bottom-0 left-0 z-50 px-6 pb-6">
      <div className="mx-auto w-full sm:max-w-2xl">
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 text-card-foreground shadow-sm">
          {/* Initialize audio player immediately for preloading */}
          <AudioPlayerInitializer item={audioItem} />

          {/* Header toolbar */}
          <div className="flex items-center gap-3">
            {/* Play/Pause button */}
            <AudioPlayerButton
              className="shrink-0 rounded-full"
              item={audioItem}
              size="icon"
              variant="default"
            />

            {/* Time display */}
            <div className="flex shrink-0 items-center gap-1 tabular-nums">
              <AudioPlayerTime />
              <span className="text-muted-foreground">/</span>
              <AudioPlayerDuration />
            </div>

            {/* Progress bar */}
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

              {/* Ask Nina button */}
              <AskNinaButton />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function AskNinaButton() {
  const open = useAi((state) => state.open);
  const setOpen = useAi((state) => state.setOpen);
  const t = useTranslations("Ai");

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button onClick={() => setOpen(!open)} size="icon" variant="ghost">
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

function AiSheet() {
  const open = useAi((state) => state.open);
  const setOpen = useAi((state) => state.setOpen);
  const t = useTranslations("Ai");

  return (
    <motion.aside
      animate={{
        y: open ? SLIDE_DISTANCE : 0,
        opacity: open ? 0 : 1,
      }}
      className="sticky right-0 bottom-0 left-0 z-50 px-6 pb-6"
      initial={{ y: SLIDE_DISTANCE, opacity: 0 }}
      key="button"
      transition={{
        duration: 0.3,
        ease: "easeOut",
      }}
    >
      <div className="mx-auto sm:max-w-xs">
        <Button
          className="w-full justify-between duration-200 hover:scale-105"
          onClick={() => setOpen(!open)}
          size="lg"
          variant="default-outline"
        >
          <div className="flex items-center gap-2">
            <HugeIcons icon={SparklesIcon} />
            <span>{t("ask-nina")}</span>
          </div>

          <HugeIcons icon={ArrowUpRight01Icon} />
        </Button>
      </div>
    </motion.aside>
  );
}
