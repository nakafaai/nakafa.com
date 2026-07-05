"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { api } from "@repo/backend/convex/_generated/api";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useRouter } from "@repo/internationalization/src/navigation";
import { useConvexAuth, useMutation } from "convex/react";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { useState } from "react";

interface StartTryoutButtonProps {
  countryKey: string;
  examKey: string;
  firstSectionHref: string;
  label: string;
  locale: Locale;
  setKey: string;
}

/** Starts a Convex-owned try-out attempt and opens the first section on success. */
export function StartTryoutButton({
  countryKey,
  examKey,
  firstSectionHref,
  label,
  locale,
  setKey,
}: StartTryoutButtonProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const startAttempt = useMutation(api.tryouts.mutations.attempts.startAttempt);
  const [isStarting, setIsStarting] = useState(false);

  function onStart() {
    if (isLoading || isStarting) {
      return;
    }

    if (!isAuthenticated) {
      router.push(`/auth?redirect=${encodeURIComponent(firstSectionHref)}`);
      return;
    }

    setIsStarting(true);

    Effect.runPromise(
      Effect.tryPromise({
        try: () =>
          startAttempt({
            countryKey,
            examKey,
            locale,
            setKey,
          }),
        catch: (cause) => cause,
      }).pipe(
        Effect.tap(() => Effect.sync(() => router.push(firstSectionHref))),
        Effect.catchAll(() => Effect.void),
        Effect.ensuring(Effect.sync(() => setIsStarting(false)))
      )
    ).then(() => undefined);
  }

  return (
    <Button disabled={isLoading || isStarting} onClick={onStart}>
      {label}
      <HugeIcons className="size-4" icon={ArrowRight02Icon} />
    </Button>
  );
}
