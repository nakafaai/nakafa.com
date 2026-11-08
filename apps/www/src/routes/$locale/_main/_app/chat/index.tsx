import { createFileRoute } from "@tanstack/react-router";
import { createTranslator } from "use-intl/core";
import { ChatNew } from "@/components/ai/chat/welcome";
import { Videos } from "@/components/ai/home/videos";
import { DeferredWeather } from "@/components/ai/home/weather/deferred";
import { signedInHead } from "@/lib/account/head";
import { readRenderedRouteMessages } from "@/lib/i18n/rendered";
import { getAppSocialArtwork } from "@/lib/og/app";

export const Route = createFileRoute("/$locale/_main/_app/chat/")({
  loader: ({ params }) =>
    readRenderedRouteMessages({ locale: params.locale, namespaces: ["Ai"] }),
  head: ({ loaderData, params: { locale } }) => {
    if (loaderData === undefined) {
      return {};
    }
    const t = createTranslator({
      locale,
      messages: loaderData,
      namespace: "Ai",
    });
    return signedInHead(
      {
        canonicalPath: `/${locale}/chat`,
        description: t("new-chat-description"),
        indexable: false,
        locale,
        title: t("new-chat-title"),
      },
      getAppSocialArtwork({ key: "ask-nina", locale, publicPath: "chat" })
    );
  },
  component: ChatPage,
});

function ChatPage() {
  return (
    <ChatNew>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Videos />
        <DeferredWeather />
      </div>
    </ChatNew>
  );
}
