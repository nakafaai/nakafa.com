import type { Locale } from "next-intl";
import { type ArtworkIdentity, resolveSocialArtwork } from "@/lib/og/artwork";

const APP_ARTWORK_IDENTITIES = {
  "ask-nakafa": "app/ask-nakafa",
  home: undefined,
  pricing: "app/pricing",
  quran: "quran/index",
  school: "app/school",
  "try-out": "tryout/index",
} as const satisfies Readonly<Record<string, ArtworkIdentity | undefined>>;

export type AppArtworkKey = keyof typeof APP_ARTWORK_IDENTITIES;

/** Maps one app-owned route to its reviewed artwork and social fallback. */
export function getAppSocialArtwork({
  key,
  locale,
  publicPath,
}: {
  readonly key: AppArtworkKey;
  readonly locale: Locale;
  readonly publicPath: string;
}) {
  return resolveSocialArtwork({
    identity: APP_ARTWORK_IDENTITIES[key],
    locale,
    publicPath,
  });
}
