import {
  required,
  tenantOf,
} from "@repo/backend/confect/acceptance/lookup";
import { requireAcceptanceSeed } from "@repo/backend/confect/acceptance/seed";
import { readLinkedPerson } from "@repo/backend/confect/guardians/authority";
import { storeCode } from "@repo/backend/confect/guardians/codes";
import { liveLinksOfAddress } from "@repo/backend/confect/guardians/link";
import { writeRosterEntry } from "@repo/backend/confect/roster/entry";
import type { Nisn } from "@repo/backend/confect/roster/schema";
import type { Email } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Effect, Option } from "effect";

/**
 * Seeds what a parent's sign-in needs in the acceptance runtime, for an address that the
 * school's Admin linked in the browser: the NISN of each linked student on the roster,
 * under the age limit, and a live code for the address. It answers the plain code, which
 * the mail would carry, so a browser test signs the parent in without a mailbox.
 */
export const seedGuardianCode = Effect.fn("guardians.seed.code")(function* (args: {
  readonly email: typeof Email.Type;
  readonly nisn: typeof Nisn.Type;
  readonly slug: string;
}) {
  yield* requireAcceptanceSeed();
  const tenant = yield* tenantOf(args.slug);
  const links = yield* liveLinksOfAddress(tenant._id, args.email);
  yield* required(Arr.head(links), "The address has no live link.");
  yield* Effect.forEach(
    links,
    (link) =>
      readLinkedPerson(link.studentPersonId).pipe(
        Effect.flatMap((student) =>
          writeRosterEntry(student, {
            nisn: Option.some(args.nisn),
            underAgeLimit: true,
          })
        )
      ),
    { discard: true }
  );
  const { code } = yield* storeCode(tenant._id, args.email);
  return { code };
});
