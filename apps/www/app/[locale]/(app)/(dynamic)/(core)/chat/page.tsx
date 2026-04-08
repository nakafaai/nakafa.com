import { Particles } from "@repo/design-system/components/ui/particles";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { ChatNew } from "@/components/ai/chat-new";
import { HomeTitle } from "@/components/ai/title";
import { Videos } from "@/components/ai/videos";
import { Weather } from "@/components/ai/weather";

export const revalidate = false;

interface Props {
  params: Promise<{ locale: Locale }>;
}

export default function Page({ params }: Props) {
  const { locale } = use(params);

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <div
      className="relative flex size-full min-h-[calc(100svh-4rem)] items-center justify-center lg:min-h-svh"
      data-pagefind-ignore
    >
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="mx-auto w-full max-w-xl px-6">
        <div className="relative flex h-full flex-col space-y-4">
          <HomeTitle />

          <ChatNew />

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Videos />
            <Weather />
          </div>
        </div>
      </div>
    </div>
  );
}
