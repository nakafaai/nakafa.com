import { createFileRoute } from "@tanstack/react-router";
import { ChatNew } from "@/components/ai/chat/new";
import { HomeTitle } from "@/components/ai/home/title";
import { Videos } from "@/components/ai/home/videos";
import { DeferredWeather } from "@/components/ai/home/weather/deferred";
import { signedInHead } from "@/lib/account/head";
import { chatIndexScreenFn } from "@/lib/account/screens.fn";

export const Route = createFileRoute("/$locale/_app/chat/")({
  loader: ({ params }) =>
    chatIndexScreenFn({ data: { locale: params.locale } }),
  head: ({ loaderData }) => loaderData && signedInHead(loaderData.seo),
  component: ChatPage,
});

function ChatPage() {
  return (
    <ChatNew title={<HomeTitle />}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Videos />
        <DeferredWeather />
      </div>
    </ChatNew>
  );
}
