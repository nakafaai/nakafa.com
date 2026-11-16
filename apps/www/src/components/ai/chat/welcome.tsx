import { Particles } from "@repo/design-system/components/ui/particles";
import {
  trimPathRight,
  useLocation,
  useMatch,
  useNavigate,
} from "@tanstack/react-router";
import { cn } from "cn";
import type { ReactNode } from "react";
import { ChatHeader } from "@/components/ai/chat/header";
import {
  NewChat,
  NewChatInput,
  useNewChatPrompt,
} from "@/components/ai/chat/new";
import { StartPrompt } from "@/components/ai/chat/start";
import { HomeTitle } from "@/components/ai/home/title";
import { pageRowVariants } from "@/components/shared/content/width";
import { chatTarget } from "@/lib/routing/target";

/**
 * The new-chat page: Nina's welcome, the composer and the cards below it, which move directly into the final
 * conversation layout once a prompt is on its way. A finished admission opens the chat's own page. A send or an
 * attach pressed while the session loads waits for the composer that follows, since the server draws this page and
 * its composer before the session starts.
 *
 * The page counts as shown while the router's location is still its own. A learner who leaves for another page has
 * left from the moment that navigation starts, while the page still draws until the next one has loaded, so an
 * admission that settles meanwhile tells them once instead of opening its chat over the page they picked.
 */
export function ChatNew({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation({ select: (current) => current.pathname });
  const own = useMatch({ strict: false, select: (match) => match.pathname });

  return (
    <NewChat
      admission={{
        onComplete: (chatId) => navigate(chatTarget(chatId)),
        // The page's own path keeps the trailing slash of its index route.
        shown: trimPathRight(location) === trimPathRight(own),
      }}
      holds
    >
      <NewChatLayout>{children}</NewChatLayout>
    </NewChat>
  );
}

/**
 * The welcome layout of a new chat. Its title stands a fixed share of the page's height from the top, so a page that
 * arrives in parts on a slow connection never moves the title when the composer and the cards below it come in.
 */
function NewChatLayout({ children }: { children: ReactNode }) {
  const prompt = useNewChatPrompt();

  return (
    <div
      className={cn(
        "text-chat relative flex size-full min-w-0 flex-col overflow-hidden",
        !prompt && "gap-4"
      )}
    >
      {prompt ? (
        <ChatHeader />
      ) : (
        <>
          <Particles className="pointer-events-none absolute inset-0 opacity-80" />
          <div className="absolute inset-x-0 top-0">
            <ChatHeader />
          </div>
        </>
      )}
      {prompt ? (
        <StartPrompt
          className={cn(pageRowVariants(), "py-6")}
          prompt={prompt}
        />
      ) : (
        <>
          <div
            aria-hidden="true"
            className="shrink-0 basis-[max(4.5rem,calc(50%-15rem))]"
          />
          <div className="relative mx-auto w-full max-w-xl px-6">
            <HomeTitle />
          </div>
        </>
      )}
      <div
        className={cn(
          pageRowVariants(),
          "relative grid shrink-0",
          prompt && "pb-4"
        )}
        key="composer"
      >
        <NewChatInput />
      </div>
      {prompt ? null : (
        <div className="relative mx-auto w-full max-w-xl px-6">{children}</div>
      )}
    </div>
  );
}
