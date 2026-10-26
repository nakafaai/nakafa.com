import { useMutation } from "@confect/react";
import { Notification01Icon } from "@hugeicons/core-free-icons";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";
import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { FeedNotice } from "@/components/user/feed";
import { clientEnv } from "@/env.public";
import { reportClientException } from "@/lib/analytics/client";
import {
  type PushState,
  readPushState,
  subscribeDevice,
} from "@/lib/notifications/device";

/**
 * The offer of push under the inbox (ADR 0027): a browser that takes push and has it off offers
 * one button that turns it on after the person's tap; an iPhone or iPad tab says that push comes
 * only from the Home Screen. A browser with push on, blocked, or without push shows nothing, and the
 * inbox stays the source of every notice either way. The offer stands at the end of the list, so
 * it moves no row when the browser answers.
 */
export function PushOffer() {
  const t = useTranslations("Notifications");
  const subscribe = useMutation(notifications.push.subscribe);
  const publicKey = clientEnv.VITE_WEB_PUSH_PUBLIC_KEY;
  const [state, setState] = useState<typeof PushState.Type | null>(null);

  // The key is fixed for the build, so the browser is read once, after the first paint.
  useEffect(() => {
    Effect.runPromise(readPushState(clientEnv.VITE_WEB_PUSH_PUBLIC_KEY)).then(
      setState
    );
  }, []);

  /** Turns push on at once, and turns it back off with the shared toast when a step fails. */
  const turnOn = () => {
    if (publicKey === undefined) {
      return;
    }
    setState("on");
    Effect.runPromise(
      subscribeDevice(publicKey).pipe(
        Effect.flatMap((keys) =>
          Effect.flatMap(
            Effect.tryPromise(() => subscribe(keys)),
            Effect.fromResult
          )
        ),
        Effect.catch((error) =>
          reportClientException(error, {
            source: "components/notifications/push",
          }).pipe(
            Effect.andThen(
              Effect.sync(() => {
                setState("off");
                toast.error({
                  description: "action-error.description",
                  title: "action-error.title",
                });
              })
            )
          )
        )
      )
    );
  };

  if (state === "homeScreen") {
    return (
      <FeedNotice>
        <p className="text-muted-foreground text-sm">{t("push-home-screen")}</p>
      </FeedNotice>
    );
  }
  if (state !== "off") {
    return null;
  }
  return (
    <FeedNotice>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{t("push-offer")}</p>
        <Button onClick={turnOn} size="sm" variant="outline">
          <HugeIcons icon={Notification01Icon} />
          {t("push-on")}
        </Button>
      </div>
    </FeedNotice>
  );
}
