"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type {
  ContentType,
  Locale,
} from "@repo/backend/convex/lib/validators/contents";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { AudioPlayerProvider } from "@repo/design-system/components/ui/audio-player";
import { cleanSlug } from "@repo/utilities/helper";
import { PageTitleProvider } from "@/components/ai/context/use-page-title";
import { SheetAudioToolbar } from "@/components/ai/sheet-audio-toolbar";
import { SheetEntry } from "@/components/ai/sheet-entry";

interface Props {
  audio?: {
    contentType: Extract<ContentType, "article" | "subject">;
    locale: Locale;
    slug: string;
  };
  contextTitle?: string;
}

/** Chooses the right Nina entry point for the current learning page. */
export function AiSheetOpen({ audio, contextTitle }: Props) {
  const sheetContextTitle = contextTitle?.trim() ?? "";
  const { data, isPending } = useQueryWithStatus(
    api.audioStudies.queries.public.getAudioBySlug,
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
    return (
      <PageTitleProvider title={sheetContextTitle}>
        <SheetEntry />
      </PageTitleProvider>
    );
  }

  return (
    <PageTitleProvider title={sheetContextTitle}>
      <AudioPlayerProvider>
        <SheetAudioToolbar data={data} />
      </AudioPlayerProvider>
    </PageTitleProvider>
  );
}
