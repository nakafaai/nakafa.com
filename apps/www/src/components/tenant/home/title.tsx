"use client";

import { Nina } from "@repo/design-system/components/ui/nina";
import type { ActSchema } from "@repo/mascot/nina/act";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { DAY_PART_ACT } from "@/components/tenant/home/greeting";

/**
 * The greeting of the school home as a title row, not a card: Nina at 40 pixels beside "Good evening, {name}" at
 * 24 pixels. The school layout computes the greeting on the server, so the name and Nina's greeting act are in the
 * first HTML, and the title line keeps its height, so the row holds its place.
 * A quiet home passes its one sentence, which sits under the row as plain muted text, and Nina takes the act of
 * the quiet state instead of her greeting. That is the home's one figure, so a quiet home shows no second one.
 * The sentence depends on the reads, so it arrives with them, under the title. Until then the title is the only
 * thing on screen, so nothing that is shown moves when the sentence arrives.
 */
export function HomeTitle({
  quiet,
}: {
  /** The act of Nina and the sentence of a quiet home, which a home with rows does not pass. */
  quiet?: { act: typeof ActSchema.Type; sentence: string } | undefined;
}) {
  const t = useTranslations("School");
  const { greeting } = useTenant();

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3">
        <Nina
          act={quiet?.act ?? DAY_PART_ACT[greeting.part]}
          label=""
          size={40}
          whole
        />
        <h2 className="min-h-8 font-medium text-2xl">
          {t(`greeting-${greeting.part}`, { name: greeting.firstName })}
        </h2>
      </div>
      {quiet === undefined ? null : (
        <p className="text-muted-foreground text-sm">{quiet.sentence}</p>
      )}
    </div>
  );
}

/**
 * The title of a home whose read failed, with the failure below it. The title stays, since the greeting does not
 * depend on the read, and the failure shows its own sentence and Try again inside the page.
 */
export function HomeFailure({ failure }: { failure: ReactNode }) {
  return (
    <>
      <HomeTitle />
      {failure}
    </>
  );
}
