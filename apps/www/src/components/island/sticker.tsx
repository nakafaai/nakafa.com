"use client";

import { useMutation } from "@confect/react";
import {
  FavouriteIcon,
  FishIcon,
  FlowerIcon,
  StarIcon,
  Sun01Icon,
  WavingHand01Icon,
} from "@hugeicons/core-free-icons";
import island from "@repo/backend/confect/_generated/refs/island";
import { Sticker } from "@repo/backend/confect/island/schema";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Array as Arr, Effect, Result } from "effect";
import { useTransition } from "react";
import { useTranslations } from "use-intl";
import { HudSheet } from "@/components/island/sheet";
import { useGame } from "@/components/island/store";
import { HudTile, HudTileLabel } from "@/components/island/tile";

/** The icon of each sticker of the fixed set (ADR 0050, W6). */
const STICKER_ICONS = {
  fish: FishIcon,
  flower: FlowerIcon,
  heart: FavouriteIcon,
  star: StarIcon,
  sun: Sun01Icon,
  wave: WavingHand01Icon,
} as const;

/** A sticker as its icon, where the guest book and the visitor's choice show it. */
export function StickerMark({ sticker }: { sticker: typeof Sticker.Type }) {
  return <HugeIcons icon={STICKER_ICONS[sticker]} />;
}

/**
 * What a visitor leaves in a guest book (ADR 0050, W6): one sticker of six,
 * the only words between learners. A press sends it and closes the sheet; a
 * book that does not take it says so in a line.
 */
export function StickerSheet() {
  const t = useTranslations("Island");
  const host = useGame((state) => state.host);
  const setSheet = useGame((state) => state.setSheet);
  const setNotice = useGame((state) => state.setNotice);
  const greet = useMutation(island.mutations.greet);
  const [isSending, startSending] = useTransition();
  if (host === null) {
    return null;
  }
  return (
    <HudSheet
      description={t("sticker-description", { name: host.name })}
      sheet="guests"
      title={t("sticker-title")}
    >
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {Arr.map(Sticker.literals, (sticker) => (
          <HudTile
            disabled={isSending}
            ground="soft"
            key={sticker}
            onClick={() =>
              startSending(() =>
                Effect.runPromise(
                  Effect.tryPromise(() =>
                    greet({ sticker, username: host.username })
                  ).pipe(
                    Effect.map((result) =>
                      Result.match(result, {
                        onFailure: () => setNotice("refused"),
                        onSuccess: () => setSheet(null),
                      })
                    ),
                    Effect.catch(() => Effect.sync(() => setNotice("refused")))
                  )
                )
              )
            }
            variant="ghost"
          >
            <StickerMark sticker={sticker} />
            <HudTileLabel>{t(`sticker-${sticker}`)}</HudTileLabel>
          </HudTile>
        ))}
      </div>
    </HudSheet>
  );
}
