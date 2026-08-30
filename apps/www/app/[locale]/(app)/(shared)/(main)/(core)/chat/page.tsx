import { Particles } from "@repo/design-system/components/ui/particles";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChatNew } from "@/components/ai/chat-new";
import { HomeTitle } from "@/components/ai/title";
import { Videos } from "@/components/ai/videos";
import { Weather } from "@/components/ai/weather";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { getAppSocialArtwork } from "@/lib/og/app-artwork";
import { getSocialMetadata } from "@/lib/utils/metadata";

/** Builds localized metadata for Nakafa's new learning chat. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/chat">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "Ai" });
  const title = t("new-chat-title");
  const description = t("new-chat-description");
  const path = `/${locale}/chat`;

  return {
    title: { absolute: title },
    description,
    ...getSocialMetadata({
      title,
      description,
      locale,
      path,
      image: getAppSocialArtwork({
        key: "ask-nakafa",
        locale,
        publicPath: "chat",
      }),
    }),
  };
}

export default function Page() {
  return (
    <div className="relative flex size-full min-h-[calc(100svh-4rem)] items-center justify-center lg:min-h-svh">
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="mx-auto w-full max-w-xl px-6">
        <div className="relative flex h-full flex-col gap-y-4">
          <HomeTitle />

          <ChatNew />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Videos />
            <Weather />
          </div>
        </div>
      </div>
    </div>
  );
}
