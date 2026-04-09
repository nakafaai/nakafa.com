import { Particles } from "@repo/design-system/components/ui/particles";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { ChatNew } from "@/components/ai/chat-new";
import { HomeTitle } from "@/components/ai/title";
import { Videos } from "@/components/ai/videos";
import { Weather } from "@/components/ai/weather";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export const revalidate = false;

export default function Page(props: PageProps<"/[locale]/chat">) {
  const { params } = props;
  const { locale: rawLocale } = use(params);
  const locale = getLocaleOrThrow(rawLocale);

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
