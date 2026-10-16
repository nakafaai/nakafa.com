"use client";

import { Animal } from "@repo/design-system/components/ui/animal";
import {
  Avatar,
  AvatarFallback,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { candidates } from "@repo/mascot/candidates";
import type { Mascot } from "@repo/mascot/code";
import { Array as Arr, Effect, Random } from "effect";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
  CardSectionHint,
} from "@/components/shared/card/section";
import { useUpdateMascotMutation } from "@/components/user/mutation.client";
import { reportClientException } from "@/lib/analytics/client";
import type { CurrentUser } from "@/lib/identity/client";

/** How many animals the card offers at once. */
const OFFERED_COUNT = 4;

/**
 * Renders the animal card: the animal on the account, four others to pick from,
 * and a button that offers four more. A pick takes effect at once.
 */
export function UserSettingsAnimal({ user }: { user: CurrentUser }) {
  const actionErrorMessage = useTranslations("Common")("action-error");
  const t = useTranslations("Auth");
  const animals = useTranslations("Animals");
  const updateMascot = useUpdateMascotMutation();
  const current = user.appUser.mascot;
  // The set on screen is a function of this seed and of the current animal, so
  // the server and the browser draw the same first set. Only the button changes
  // the seed.
  const [seed, setSeed] = useState(0);
  const offered = Effect.runSync(
    candidates(OFFERED_COUNT, current.animal).pipe(Random.withSeed(seed))
  );

  const pick = (mascot: typeof Mascot.Type) =>
    Effect.runPromise(
      Effect.tryPromise(() => updateMascot({ mascot })).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.matchEffect({
          onSuccess: () => Effect.void,
          onFailure: (error) =>
            reportClientException(error, {
              source: "components/user/settings/animal",
            }).pipe(
              Effect.andThen(
                Effect.sync(() => {
                  toast.error(actionErrorMessage);
                })
              )
            ),
        })
      )
    );

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("animal")}</CardTitle>
        <CardDescription>{t("animal-description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        <Avatar className="size-18 shrink-0">
          <AvatarFallback>
            <Animal mascot={current} />
          </AvatarFallback>
        </Avatar>
        <ul className="flex flex-wrap gap-2">
          {Arr.map(offered, (mascot) => (
            <li key={mascot.animal}>
              <button
                aria-label={t("animal-pick", {
                  animal: animals(mascot.animal),
                })}
                className="cursor-pointer rounded-full outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95"
                onClick={() => pick(mascot)}
                type="button"
              >
                <Avatar className="size-12">
                  <AvatarFallback>
                    <Animal mascot={mascot} />
                  </AvatarFallback>
                </Avatar>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardSectionFooter>
        <CardSectionHint>{t("animal-footer")}</CardSectionHint>
        <CardSectionActions>
          <Button
            onClick={() => setSeed(Effect.runSync(Random.nextInt))}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("animal-shuffle")}
          </Button>
        </CardSectionActions>
      </CardSectionFooter>
    </CardSection>
  );
}
