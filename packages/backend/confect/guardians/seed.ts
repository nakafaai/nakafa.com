import { seedPasswordAccount } from "@repo/backend/confect/acceptance/account";
import { required, tenantOf } from "@repo/backend/confect/acceptance/lookup";
import { requireAcceptanceSeed } from "@repo/backend/confect/acceptance/seed";
import { readLinkedPerson } from "@repo/backend/confect/guardians/authority";
import { claimGuardianPersons } from "@repo/backend/confect/guardians/claim";
import { liveLinksOfAddress } from "@repo/backend/confect/guardians/link";
import {
  schoolKeys,
  writeRosterEntry,
} from "@repo/backend/confect/roster/entry";
import type { Nisn } from "@repo/backend/confect/roster/schema";
import type { Email } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Effect } from "effect";

/**
 * Seeds what a parent's sign-in needs in the acceptance runtime, for an address that the
 * school's Admin linked in the browser: the NISN of each linked student on the roster,
 * under the age limit, and the account of the address, which claims its guardian Persons
 * as a Google sign-in of that address does (ADR 0034). It answers the account and its
 * password, so a browser test signs the parent in without Google.
 */
export const seedGuardianAccount = Effect.fn("guardians.seed.account")(
  function* (args: {
    readonly email: typeof Email.Type;
    readonly nisn: typeof Nisn.Type;
    readonly slug: string;
  }) {
    yield* requireAcceptanceSeed();
    const tenant = yield* tenantOf(args.slug);
    const links = yield* liveLinksOfAddress(tenant._id, args.email);
    const first = yield* required(
      Arr.head(links),
      "The address has no live link."
    );
    const keys = yield* schoolKeys(tenant._id);
    yield* Effect.forEach(
      links,
      (link) =>
        readLinkedPerson(link.studentPersonId).pipe(
          Effect.flatMap((student) =>
            writeRosterEntry(keys, student, args.nisn)
          )
        ),
      { discard: true }
    );
    const guardian = yield* readLinkedPerson(first.guardianPersonId);
    const account = yield* seedPasswordAccount({
      email: args.email,
      name: guardian.name,
    });
    yield* claimGuardianPersons(account.userId, args.email);
    return account;
  }
);
