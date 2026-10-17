import { Schema } from "effect";

/**
 * What draws an account where its person shows: its animal, or the photo of its
 * Google account. An account that never chose a picture draws its animal.
 */
export const UserPicture = Schema.Literals(["animal", "photo"]);

/**
 * The photo an account shows, or none. The photo shows only when the account
 * chose it and holds one, so a chosen photo that the account no longer has
 * falls back to the animal. An empty address is no photo.
 */
export function photoOf(account: {
  readonly image?: string | null | undefined;
  readonly picture?: typeof UserPicture.Type | undefined;
}): string | undefined {
  return account.picture === "photo" && account.image
    ? account.image
    : undefined;
}
