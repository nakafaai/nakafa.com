"use client";

import { ArrowUpRight01Icon, SparklesIcon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import type {
  ContentType,
  Locale,
} from "@repo/backend/convex/lib/validators/contents";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import {
  AudioPlayerButton,
  AudioPlayerProgress,
  AudioPlayerProvider,
  AudioPlayerSpeed,
  AudioPlayerTime,
  useAudioPlayer,
} from "@repo/design-system/components/ui/audio-player";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Orb } from "@repo/design-system/components/ui/orb";
import { cleanSlug } from "@repo/utilities/helper";
import type { FunctionReturnType } from "convex/server";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { getColorFront } from "@/components/marketing/about/utils";
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
  const { data, isPending, error } = useQueryWithStatus(
    api.audioStudies.public.queries.getAudioBySlug,
    audio
      ? {
          slug: cleanSlug(audio.slug),
          locale: audio.locale,
          contentType: audio.contentType,
        }
      : "skip"
  );

  // Debug logging
  useEffect(() => {
    if (data) {
      console.log("Audio data received:", data);
      console.log("Audio URL:", data.audioUrl);
      console.log("Audio URL type:", typeof data.audioUrl);
      console.log("Audio URL length:", data.audioUrl?.length);
      console.log(
        "Audio URL starts with https:",
        data.audioUrl?.startsWith("https://")
      );
    }
    if (error) {
      console.error("Audio query error:", error);
    }
  }, [data, error]);

  if (isPending) {
    return null;
  }

  // Validate that we have a proper audio URL
  const hasValidAudio =
    data?.audioUrl &&
    typeof data.audioUrl === "string" &&
    data.audioUrl.length > 0 &&
    data.audioUrl.startsWith("https://");

  if (!hasValidAudio) {
    console.log("No valid audio data or URL, showing AiSheet. Data:", data);
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
  return (
    <aside className="sticky right-0 bottom-0 left-0 z-50 px-6 pb-6">
      <div className="mx-auto w-full sm:max-w-2xl">
        <div className="flex flex-col rounded-xl border bg-background p-4 shadow-sm">
          {/* Header toolbar */}
          <div className="flex items-center gap-3">
            {/* Play/Pause button */}
            <AudioPlayerButton
              className="h-10 w-10 shrink-0 rounded-full"
              item={{
                id: data.audioUrl,
                src: data.audioUrl,
                data: { duration: data.duration },
              }}
              size="icon"
              variant="default"
            />

            {/* Time display */}
            <div className="flex shrink-0 items-center gap-1 text-xs tabular-nums">
              <AudioPlayerTime />
              <span className="text-muted-foreground">/</span>
              <DurationDisplay initialDuration={data.duration} />
            </div>

            {/* Progress bar */}
            <div className="min-w-0 flex-1">
              <AudioPlayerProgress className="w-full" />
            </div>

            <div className="flex items-center">
              <AudioPlayerSpeed size="icon" variant="ghost" />

              {/* Ask Nina button */}
              <AskNinaButton />
            </div>
          </div>

          {/* Audio visualizer */}
          <AudioOrbVisualizer />
        </div>
      </div>
    </aside>
  );
}

function AudioOrbVisualizer() {
  const player = useAudioPlayer();
  const { resolvedTheme } = useTheme();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const volumeRef = useRef(0);

  const colorFront = getColorFront(resolvedTheme);

  // Setup audio analyser when playing
  useEffect(() => {
    if (!(player.isPlaying && player.ref.current)) {
      volumeRef.current = 0;
      return;
    }

    // Create audio context and analyser if not exists
    if (!audioContextRef.current) {
      const audioContext = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
      audioContextRef.current = audioContext;
    }

    const audioContext = audioContextRef.current;

    // Resume context if suspended
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    // Create analyser
    if (!analyserRef.current) {
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
    }

    // Connect audio element to analyser
    if (!sourceRef.current && player.ref.current) {
      try {
        const source = audioContext.createMediaElementSource(
          player.ref.current
        );
        source.connect(analyserRef.current);
        analyserRef.current.connect(audioContext.destination);
        sourceRef.current = source;
      } catch {
        // Already connected
      }
    }

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    // Animation loop to update volume
    const animate = () => {
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      let sum = 0;
      for (const value of dataArray) {
        sum += value;
      }
      const average = sum / dataArray.length / 255;
      volumeRef.current = average;

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [player.isPlaying, player.ref]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Get volume function for Orb
  const getVolume = () => volumeRef.current;

  return (
    <div className="mx-auto">
      <div className="relative size-24 rounded-full bg-muted p-1 shadow-xs">
        <div className="size-full overflow-hidden rounded-full bg-background shadow-xs">
          <Orb
            agentState={player.isPlaying ? "talking" : undefined}
            colors={[colorFront, "#00000000"]}
            getOutputVolume={getVolume}
            volumeMode="auto"
          />
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function AskNinaButton() {
  const setOpen = useAi((state) => state.setOpen);
  const t = useTranslations("Ai");

  return (
    <Button onClick={() => setOpen(true)} variant="ghost">
      <span className="hidden sm:inline">{t("ask-nina")}</span>
      <HugeIcons className="size-4" icon={ArrowUpRight01Icon} />
    </Button>
  );
}

function DurationDisplay({ initialDuration }: { initialDuration: number }) {
  const player = useAudioPlayer();

  // Use player's duration if available, otherwise use initial duration from backend
  const duration =
    player.duration !== null &&
    player.duration !== undefined &&
    Number.isFinite(player.duration)
      ? player.duration
      : initialDuration;

  return (
    <span className="text-muted-foreground text-sm tabular-nums">
      {formatTime(duration)}
    </span>
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
