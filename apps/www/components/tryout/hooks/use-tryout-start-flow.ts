"use client";

import { useDisclosure } from "@mantine/hooks";
import type { api } from "@repo/backend/convex/_generated/api";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useConvexAuth } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { useTranslations } from "next-intl";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import { startTryout } from "@/components/tryout/actions/tryout";

export type TryoutStartParams = FunctionArgs<
  typeof api.tryouts.mutations.attempts.startTryout
>;

export type TryoutRouteAccess = "anonymous" | "authenticated";

/**
 * Owns the shared start-tryout actions for routes that can open the tryout
 * start dialog.
 */
export function useTryoutStartFlow({
  access,
  partKeys,
  params,
  resumePartKey,
}: {
  access: TryoutRouteAccess;
  partKeys: readonly string[];
  params: TryoutStartParams;
  resumePartKey?: string;
}) {
  const tTryouts = useTranslations("Tryouts");
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [isActionPending, startTransition] = useTransition();
  const [isDialogOpen, { close: closeDialog, open: openDialog }] =
    useDisclosure(false);
  const authHref = `/auth?redirect=${pathname}`;
  const isAuthPending = access === "authenticated" && isLoading;
  const isStartBlocked = isActionPending || isAuthPending;

  const setDialogOpenAction = useCallback(
    (open: boolean) => {
      if (open) {
        openDialog();
        return;
      }

      closeDialog();
    },
    [closeDialog, openDialog]
  );

  const clickStartAction = useCallback(() => {
    if (access === "authenticated" && isLoading) {
      return;
    }

    if (access === "anonymous" || !isAuthenticated) {
      router.push(authHref);
      return;
    }

    if (resumePartKey) {
      router.push(
        `/try-out/${params.product}/${params.tryoutSlug}/part/${resumePartKey}`
      );
      return;
    }

    openDialog();
  }, [
    access,
    authHref,
    isAuthenticated,
    isLoading,
    openDialog,
    params.product,
    params.tryoutSlug,
    resumePartKey,
    router,
  ]);

  const prefetchAuthAction = useCallback(() => {
    if (access === "authenticated" && isLoading) {
      return;
    }

    if (access === "authenticated" && isAuthenticated) {
      return;
    }

    router.prefetch(authHref);
  }, [access, authHref, isAuthenticated, isLoading, router]);

  const confirmStartAction = useCallback(() => {
    if (access === "authenticated" && isLoading) {
      return;
    }

    if (access === "anonymous" || !isAuthenticated) {
      router.push(authHref);
      return;
    }

    startTransition(async () => {
      const result = await startTryout({
        ...params,
        partKeys,
        returnPath: pathname,
      });

      if (result.ok) {
        closeDialog();
        router.replace(pathname);
        toast.success(tTryouts("start-success"), {
          position: "bottom-center",
        });
        return;
      }

      if (result.code === "COMPETITION_ATTEMPT_ALREADY_USED") {
        closeDialog();
        toast.info(tTryouts("competition-attempt-used-error"), {
          position: "bottom-center",
        });
        return;
      }

      if (result.code === "TRYOUT_ACCESS_REQUIRED") {
        window.location.href = result.url;
        return;
      }

      toast.error(tTryouts("start-error"), {
        position: "bottom-center",
      });
    });
  }, [
    access,
    closeDialog,
    isAuthenticated,
    isLoading,
    partKeys,
    params,
    pathname,
    authHref,
    router,
    tTryouts,
  ]);

  return {
    clickStartAction,
    confirmStartAction,
    isActionPending,
    isDialogOpen,
    isStartBlocked,
    prefetchAuthAction,
    setDialogOpenAction,
  };
}
