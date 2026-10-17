"use client";

import { photoOf, UserPicture } from "@repo/backend/confect/users/picture";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { anotherMascot } from "@repo/mascot/candidates";
import { Array as Arr, Effect, Option, type Result, Schema } from "effect";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import {
  useUpdateMascotMutation,
  useUpdatePictureMutation,
} from "@/components/user/mutation.client";
import { reportClientException } from "@/lib/analytics/client";
import type { CurrentUser } from "@/lib/identity/client";

/**
 * Runs one save of the account from a browser event. A save that the server
 * refuses is reported, and the person sees the error message; the optimistic copy
 * steps back by itself.
 */
function saveAccount<A, E>(
  write: () => Promise<Result.Result<A, E>>,
  errorMessage: string
) {
  return Effect.runPromise(
    Effect.tryPromise(write).pipe(
      Effect.flatMap(Effect.fromResult),
      Effect.matchEffect({
        onSuccess: () => Effect.void,
        onFailure: (error) =>
          reportClientException(error, {
            source: "components/user/settings/picture",
          }).pipe(
            Effect.andThen(
              Effect.sync(() => {
                toast.error(errorMessage);
              })
            )
          ),
      })
    )
  );
}

/**
 * Renders the profile picture card: the picture that shows for the account, a
 * choice of the animal or the Google photo when the account has a photo, and a
 * button that shuffles the animal. A change takes effect at once.
 */
export function UserSettingsPicture({ user }: { user: CurrentUser }) {
  const actionErrorMessage = useTranslations("Common")("action-error");
  const t = useTranslations("Auth");
  const updatePicture = useUpdatePictureMutation();
  const updateMascot = useUpdateMascotMutation();
  const { appUser } = user;
  const photo = photoOf(appUser);
  const picture = appUser.picture ?? "animal";
  const pictureLabels: Record<typeof UserPicture.Type, string> = {
    animal: t("picture-animal"),
    photo: t("picture-photo"),
  };
  const pictureItems = Arr.map(UserPicture.literals, (value) => ({
    label: pictureLabels[value],
    value,
  }));

  /** Shows and saves another animal, never the one that shows now. */
  const shuffle = () => {
    const mascot = Effect.runSync(anotherMascot(appUser.mascot.animal));
    return saveAccount(() => updateMascot({ mascot }), actionErrorMessage);
  };

  /** Saves the choice of the Select. A value that is no picture, or the one that shows, saves nothing. */
  const choose = (value: string | null) => {
    const parsed = Schema.decodeUnknownOption(UserPicture)(value);
    if (Option.isSome(parsed) && parsed.value !== picture) {
      saveAccount(
        () => updatePicture({ picture: parsed.value }),
        actionErrorMessage
      );
    }
  };

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("picture")}</CardTitle>
        <CardDescription>{t("picture-description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-4">
        <PersonAvatar
          className="size-18"
          mascot={appUser.mascot}
          photo={photo}
        />
        {appUser.image ? (
          <Field>
            <FieldLabel className="sr-only" htmlFor="user-settings-picture">
              {t("picture")}
            </FieldLabel>
            <Select items={pictureItems} onValueChange={choose} value={picture}>
              <SelectTrigger
                className="w-full max-w-xs"
                id="user-settings-picture"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Arr.map(pictureItems, (item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        ) : null}
      </CardContent>
      <CardSectionFooter>
        <div className="flex w-full items-center justify-between gap-4">
          {photo === undefined ? (
            <>
              <p className="text-muted-foreground text-sm">
                {t("picture-footer-animal")}
              </p>
              <Button onClick={shuffle} size="sm" type="button">
                {t("animal-shuffle")}
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("picture-footer-photo")}
            </p>
          )}
        </div>
      </CardSectionFooter>
    </CardSection>
  );
}
