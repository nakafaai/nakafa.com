"use client";

import { BrandLogo } from "@repo/design-system/components/logos/brand";
import { Button } from "@repo/design-system/components/ui/button";
import { Effect } from "effect";
import { useLocale, useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { useState, useTransition } from "react";
import { reportClientException } from "@/lib/analytics/client";
import {
  getPostAuthContinuationHref,
  getPostAuthProviderErrorHref,
  isPostAuthProviderError,
} from "@/lib/auth/admission";
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";
import { startGoogleSignIn } from "@/lib/auth/social";
import { requestGoogleSignIn } from "@/lib/auth/social.client";

interface Props {
  redirect?: string;
}

/** Renders the Google sign-in button with one sanitized internal callback URL. */
export function AuthGoogle({ redirect }: Props) {
  const locale = useLocale();
  const t = useTranslations("Auth");
  const [redirectQuery] = useQueryState("redirect");
  const [errorQuery] = useQueryState("error");
  const [hasClientError, setHasClientError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const authNavigation = useCurrentAuthNavigation();
  const hasProviderError =
    hasClientError || isPostAuthProviderError(errorQuery);

  /** Starts the Better Auth Google flow with one safe callback destination. */
  function handleGoogleSignIn() {
    setHasClientError(false);
    startTransition(async () => {
      const intentSource =
        redirect ?? redirectQuery ?? authNavigation.readIntentSource();
      const callbackURL = getPostAuthContinuationHref(intentSource, locale);
      const errorCallbackURL = getPostAuthProviderErrorHref(
        intentSource,
        locale
      );
      const started = await Effect.runPromise(
        startGoogleSignIn(
          { callbackURL, errorCallbackURL },
          requestGoogleSignIn
        ).pipe(
          Effect.tapError((error) =>
            reportClientException(error, { source: "google-sign-in" })
          ),
          Effect.match({
            onFailure: () => false,
            onSuccess: () => true,
          })
        )
      );
      if (!started) {
        startTransition(() => setHasClientError(true));
      }
    });
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      {hasProviderError ? (
        <p className="text-center text-destructive text-sm" role="alert">
          {t("provider-error")}
        </p>
      ) : null}
      <Button
        aria-busy={isPending || undefined}
        disabled={isPending}
        onClick={handleGoogleSignIn}
      >
        <BrandLogo name="google" />
        {isPending ? t("opening-google") : t("continue-with-google")}
      </Button>
    </div>
  );
}
