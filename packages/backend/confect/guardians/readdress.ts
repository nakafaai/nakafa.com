import type {
  GuardianLinksDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { guardianLinkAuthority } from "@repo/backend/confect/guardians/authority";
import {
  LinkClosed,
  LinkRefused,
} from "@repo/backend/confect/guardians/errors";
import {
  isLive,
  linksOfAddress,
  linksOfGuardian,
  replaceLink,
} from "@repo/backend/confect/guardians/link";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { createPerson } from "@repo/backend/confect/tenancy/create";
import type { Email } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Clock, Effect, Option, Struct } from "effect";

/**
 * The guardian Person a link takes with a new address. An address signs in as the guardian of its first live link
 * (`redeemCode`), so every link of one address keeps one guardian: an address that already guards a child of the
 * school brings its guardian, as `start` does. Otherwise the link keeps its guardian while that Person is unclaimed
 * and guards no other link. Once someone signed in as the guardian, the sign-in proved the old address and not the
 * new one, and a guardian of another link stays with that link, so a new Person of the same name takes this one.
 */
const guardianOf = Effect.fn("guardians.readdress.guardian")(function* (
  link: GuardianLinksDoc,
  addressLinks: readonly GuardianLinksDoc[],
  actor: TenantPeopleDoc
) {
  const reader = yield* DatabaseReader;
  const kept = Arr.head(addressLinks);
  if (Option.isSome(kept)) {
    return yield* reader
      .table("tenantPeople")
      .get(kept.value.guardianPersonId)
      .pipe(Effect.orDie);
  }
  const current = yield* reader
    .table("tenantPeople")
    .get(link.guardianPersonId)
    .pipe(Effect.orDie);
  const held = yield* linksOfGuardian(current._id);
  if (current.account.state === "unclaimed" && Arr.length(held) === 1) {
    return current;
  }
  return yield* createPerson(personActor(actor), link.tenantId, current.name);
});

/**
 * Corrects the address of a pending link inside its term, which keeps its term: staff fix a mistyped address without
 * ending the link and starting it again. The new address must not hold a live link to the same student. Failed NISN
 * checks count again from none, since they were made from the old address. The change is journaled as
 * `guardian.readdressed`; nothing is sent, because the guardian asks for a code at `/parents` with the new address.
 * The same address answers the link as it stands.
 */
export const readdressLink = Effect.fn("guardians.readdress")(function* (
  link: GuardianLinksDoc,
  email: typeof Email.Type,
  actor: TenantPeopleDoc
) {
  const now = yield* Clock.currentTimeMillis;
  if (link.state.status !== "pending" || !isLive(link, now)) {
    return yield* new LinkClosed();
  }
  if (email === link.email) {
    return link;
  }
  const addressLinks = yield* linksOfAddress(link.tenantId, email);
  if (
    Arr.some(
      addressLinks,
      (other) =>
        other.studentPersonId === link.studentPersonId && isLive(other, now)
    )
  ) {
    return yield* new LinkRefused({
      code: "ALREADY_LINKED",
      message: "This address already has a live link to the student.",
    });
  }
  const guardian = yield* guardianOf(link, addressLinks, actor);
  const next = yield* replaceLink(
    Struct.assign(link, {
      email,
      guardianPersonId: guardian._id,
      mismatches: 0,
    })
  );
  yield* guardianLinkAuthority.record(personActor(actor), next, {
    guardian: guardian._id,
    student: next.studentPersonId,
    type: "guardian.readdressed",
  });
  return next;
});
