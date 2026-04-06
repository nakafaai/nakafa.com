"use client";

import { useDisclosure } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { products } from "@repo/backend/convex/utils/polar/products";
import {
  usePathname,
  useRouter,
} from "@repo/internationalization/src/navigation";
import { useAction, useConvexAuth, useMutation } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";

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
  params,
  resumePartKey,
}: {
  access: TryoutRouteAccess;
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
  const startTryout = useMutation(api.tryouts.mutations.attempts.startTryout);
  const generateCheckoutLink = useAction(
    api.customers.actions.public.generateCheckoutLink
  );
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
      router.push(`/auth?redirect=${pathname}`);
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
    isAuthenticated,
    isLoading,
    openDialog,
    params.product,
    params.tryoutSlug,
    pathname,
    resumePartKey,
    router,
  ]);

  const confirmStartAction = useCallback(() => {
    if (access === "authenticated" && isLoading) {
      return;
    }

    if (access === "anonymous" || !isAuthenticated) {
      router.push(`/auth?redirect=${pathname}`);
      return;
    }

    startTransition(async () => {
      try {
        await startTryout(params);
        closeDialog();
        toast.success(tTryouts("start-success"), {
          position: "bottom-center",
        });
      } catch (error) {
        if (error instanceof ConvexError) {
          const errorData = error.data;

          if (typeof errorData === "object" && errorData !== null) {
            const errorCode = "code" in errorData ? errorData.code : undefined;

            if (errorCode === "COMPETITION_ATTEMPT_ALREADY_USED") {
              closeDialog();
              toast.info(tTryouts("competition-attempt-used-error"), {
                position: "bottom-center",
              });
              return;
            }

            if (errorCode === "TRYOUT_ACCESS_REQUIRED") {
              try {
                const { url } = await generateCheckoutLink({
                  productIds: [products.pro.id],
                  successUrl: window.location.href,
                });

                window.location.href = url;
                return;
              } catch {
                toast.error(tTryouts("start-error"), {
                  position: "bottom-center",
                });
                return;
              }
            }
          }
        }

        toast.error(tTryouts("start-error"), {
          position: "bottom-center",
        });
      }
    });
  }, [
    access,
    closeDialog,
    generateCheckoutLink,
    isAuthenticated,
    isLoading,
    params,
    pathname,
    router,
    startTryout,
    tTryouts,
  ]);

  return {
    clickStartAction,
    confirmStartAction,
    isActionPending,
    isDialogOpen,
    isStartBlocked,
    setDialogOpenAction,
  };
}
