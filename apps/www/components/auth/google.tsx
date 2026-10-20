"use client";

import { BrandLogo } from "@repo/design-system/components/logos/brand";
import { Button } from "@repo/design-system/components/ui/button";
import { Effect } from "effect";
import { useQueryState } from "nuqs";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { type ComponentProps, useState, useTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import { reportClientException } from "@/lib/analytics/client";
import {
  getPostAuthOnboardingHref,
  getPostAuthProviderErrorHref,
  isPostAuthProviderError,
} from "@/lib/auth/admission";
import { useCurrentAuthNavigation } from "@/lib/auth/location.client";
import { startGoogleSignIn } from "@/lib/auth/social";
import { requestGoogleSignIn } from "@/lib/auth/social.client";

interface Props {
  /**
   * A path on the host the visitor signs in from, such as the root of a school.
   * Google returns the visitor to that host, in place of a Nakafa destination.
   */
  returnPath?: string | undefined;
  /** The button's look. A page that shows another primary action beside it asks for `outline`. */
  variant?: ComponentProps<typeof Button>["variant"];
}

/**
 * Renders the Google sign-in button. It returns the visitor to one sanitized
 * internal destination, or to `returnPath` on the host the button is on.
 */
/** The sign-in button reads the sign-in query state, so it mounts the adapter it reads through. */
export function AuthGoogle(props: Props) {
  return (
    <NuqsAdapter>
      <AuthGoogleButton {...props} />
    </NuqsAdapter>
  );
}

function AuthGoogleButton({ returnPath, variant }: Props) {
  const locale = useLocale();
  const t = useTranslations("Auth");
  const tToast = useTranslations("Toast");
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
      const intentSource = redirectQuery ?? authNavigation.readIntentSource();
      const callbackURL =
        returnPath === undefined
          ? getPostAuthOnboardingHref(intentSource, locale)
          : new URL(returnPath, window.location.href).href;
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
    <div className="flex flex-col items-center gap-2">
      {hasProviderError ? (
        <div
          className="max-w-sm text-center text-destructive text-sm"
          role="alert"
        >
          <p className="font-medium">{tToast("provider-error.title")}</p>
          <p>{tToast("provider-error.description")}</p>
        </div>
      ) : null}
      <Button
        aria-busy={isPending || undefined}
        disabled={isPending}
        onClick={handleGoogleSignIn}
        variant={variant}
      >
        <BrandLogo name="google" />
        {isPending ? t("opening-google") : t("continue-with-google")}
      </Button>
    </div>
  );
}
