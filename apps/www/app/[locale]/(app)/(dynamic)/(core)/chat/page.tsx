import { Particles } from "@repo/design-system/components/ui/particles";
import { ChatNew } from "@/components/ai/chat-new";
import { HomeTitle } from "@/components/ai/title";
import { Videos } from "@/components/ai/videos";
import { Weather } from "@/components/ai/weather";

export default function Page() {
  return (
    <div className="relative flex size-full min-h-[calc(100svh-4rem)] items-center justify-center lg:min-h-svh">
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
