# ADR 0034: A Guardian Reaches A Child Through A Verified Link, And Consent Is A Ledger

## Status

Accepted on 18 October 2026, by the orchestrator under the owner's standing
instruction to decide, verify, and record. It applies the owner's decisions K2
and K3 (approved 13 October 2026). Counsel reviews the wording (K20), and nothing
waits for that review. The Implementation Status table at the end says which parts
are live.

Amended on 31 October 2026 by the owner's standing rule of 2 October 2026: signing
in means acceptance, and for a user under 18 that a parent, guardian, or teacher has
agreed. A school's data processing agreement covers its students. No gate refuses a
student, so the under-18 gate is removed, and the age flag it read goes with it (see
Age). The consent ledger stays, because a guardian's access to a child depends on it.

## Context

ADR 0012 says the Guardian role opens nothing by role, and a guardian reaches a
child only through a verified parent relation, which is planned. The relation has
two names in the repository today: the notification rules use `guardian`
(`notifications/rules.ts`), and ADR 0012 names it `verified parent`. The
`BuiltinRole` list keeps `guardian` for its label, "Orang tua".

A parent signs in with Google (ADR 0009). Google verifies the parent's address,
which is what the earlier six-digit email code proved, so no code is drawn,
mailed, or stored (amended 13 November 2026, with the move to Convex Auth).

K2 (owner, 13 October 2026) says the school is the data controller, signing in is
not a child's consent, and a parent consents with a verified address plus a
second check. The time, method, policy version, and checker are recorded. K2 also held a
student below the age limit back from Nina, the class forum, and active grading
until that consent. The owner's rule of 2 October 2026 replaces that part (see
Status).

The consent ledger that exists is for analytics only. `consents/schema.ts` keys
it by user and by analytics category, so the guardian ledger is a new table
(`guardianConsents`) and the analytics ledger stays as it is.

Amended on 31 October 2026: a student starts a link for themself, and the link
waits for the same guardian checks (see Linking a guardian).

## Decision

### The relation

- The relation is `verifiedParent`, the name ADR 0012 gives it. It links one
  guardian Person to one student Person in one school, and it exists only while
  the link is verified and no consent has been withdrawn.
- The Guardian role grants nothing. It stays in `BuiltinRole` for the label, and
  an action of a guardian is always a relation action (ADR 0012).
- `notifications/rules.ts` renames its `guardian` relation to `verifiedParent` in
  S9. The change touches only the rule table, not a stored row.
- A guardian reads the student's released grades, approved report cards,
  announcements, and the Insight narratives that the student shared and a teacher
  approved (ADR 0012). A guardian never reads the class forum, unreleased grades,
  another student's data, and never changes grades, tasks, or answers (blueprint,
  Orang tua).

### Linking a guardian

1. The school's Admin or Staff (Staf TU) starts a link: the student, and the
   guardian's email address. A student starts one for themself from the Parents
   page, through the `self` relation of `guardian.link`, and holds at most four
   live links. Either way nothing about the link is verified yet. The link is a
   row with the same 14-day expiry as an invite (GLOSSARY, Invite). Nothing is sent
   to a guardian who has no link.
2. The guardian signs in with Google with that address. Each sign-in binds the
   guardian Person of every live link of the verified address that no account
   holds yet (`claimGuardianPersons`, claim method `address`).
3. The guardian enters the student's NISN, and the server compares it with the
   roster. The NISN is never shown back, and it is compared through the blind
   hash of the school key (ADR 0030, Blind word), so no plain NISN is read to
   check it.
4. When the roster has no NISN for the student, or the check cannot run, Staff
   verifies the link instead. The ledger then records the staff Person as the
   checker, with the method `staff`.
5. On success the server writes a `granted` consent row and the relation
   becomes active in the same transaction. It journals `guardian.linked`.

A mismatch leaves the link unverified. The guardian sees one message whatever
failed, and Staff sees the mismatch in the link list. Nothing reveals
which of the two checks failed.

### The verified address

- The proof of a guardian's address is Google's: the sign-in admits only an
  address that Google verified (ADR 0009), and the claim matches it exactly to
  the address the link names, both lowercase.
- Nothing is mailed to a guardian, and no code is stored.

### The consent ledger

`guardianConsents` is append-only. A withdrawal is a new row, never an update.

| Field | Holds |
| --- | --- |
| `tenantId` | The school |
| `studentPersonId`, `guardianPersonId` | The two Persons of the relation |
| `action` | `granted` or `withdrawn` |
| `at` | The server time of the row |
| `method` | `address_nisn` for the verified address and the NISN check, or `staff` for a manual check |
| `policyVersion` | The version of the signed consent rule of the country profile (ADR 0032). Until the profile is signed, a version constant in code, named for the profile it stands in for |
| `checker` | The Person who gave the check: the guardian for `address_nisn`, or the staff Person for `staff` |

A row holds IDs and codes only, never a name, an email address, or free text
(ADR 0016). Withdrawal applies at once: its row ends the relation in the same
transaction, and it journals `guardian.withdrawn`, which tells the school the
withdrawal is done (blueprint, Orang tua, requests).

### Age

- Nakafa keeps no age. No birth date and no age flag are stored, and the import reads
  no birth date and no NIK (ADR 0015, K13).
- No gate refuses a student. Signing in means the user accepts the Terms and the
  Privacy Policy and, for a user under 18, that a parent, guardian, or teacher has
  agreed. A school's data processing agreement covers its students. A student uses
  Nina, the class forum, and every other feature from the first sign-in, with or
  without a guardian's link.
- Quiet hours are on for every student, and only the school's DPIA can relax them
  (ADR 0027).

### Notices and channels

- A guardian's push is for released grades and late tasks only. A guardian's
  email is a link, and it names no student, grade, or message (ADR 0027).
- A guardian gets no forum mention.

### Requests

- A report copy request and a data correction request reach Staff (Staf TU), who
  approves or declines each one (blueprint, Orang tua, requests). A parent with a
  verified link asks from the parent home, Staff answers from the guardian links
  page, and the answer shows on the parent home. What a parent writes is sealed
  with the school key. Staff hands the copy over or makes the correction itself,
  and the answer records that it was decided.

## Consequences

- A guardian's power is one relation, which ends at once when the link or the
  consent ends. No role grants reach to the child, so a role change never widens
  a guardian's view.
- Every consent is a row with a time, a method, a policy version, and a checker,
  so a school can show which check admitted a guardian and under which rule.
- No age value is stored anywhere.
- Withdrawal cannot be undone by a click. A guardian who withdraws links again
  through the same verification, and the old rows stay in the ledger.

## Rejected Alternatives

- An email code for guardians, kept after the move to Convex Auth. Google already
  verifies the address, so a code would add a secret to store and a mail to send
  and prove nothing more.
- A `guardian` relation with the role's name. The role grants nothing, so the
  relation name should say what the link is (ADR 0012).
- An update of the consent state in place. The ledger must show every change.
- Storing a birth date or an age flag. Nothing reads an age.

## What Stays Open

- The consent wording and the policy version for the first school, after counsel
  reviews the Indonesian rules (K20).
- The handling of a guardian who has several children in several schools. The
  relation is per school, and the parent home (blueprint, Orang tua) is undecided.

## Implementation Status

| Part | Status |
| --- | --- |
| The decision in this ADR | Recorded by S0 |
| `verifiedParent` relation and the link rows | Built, S7: `guardianLinks` and the `guardianLink` kind (`confect/guardians`). Admin and Staff start, list, check by hand, and revoke links (`guardians/links`). An address reuses its guardian Person, and one address holds one live link to a student. |
| The verified address (replaced the email code on 13 November 2026) | Built: a guardian signs in with Google, and `guardians/claim.ts` binds the guardian Persons of the address's live links (claim method `address`). |
| `guardianConsents` and the NISN second check | Built, S8: the guardian's check compares the blind of the typed NISN with the roster's (`guardians/family:confirm`). Three mismatches leave only the staff check. Withdrawal writes the `withdrawn` row with the method of its grant and ends the link in one transaction. |
| The NISN on the school roster | Built: `rosterEntries` holds the NISN, sealed and blinded under the school key (`confect/roster`). Admin and Staff set it with `roster/entries:set`, and the Dapodik import sets it (ADR 0015). |
| Guardian notices and the rename of the notification relation | Planned, S9 |
| Parent home, shared narratives, and requests | Partly built, S10: the parent home at `/parents` lists each linked child, runs the NISN check, shows the released grades of a verified link, and withdraws consent. Shared narratives wait for Insight (ADR 0035), and report copy and correction requests are built (`guardians/requests`). |

Counsel reviews the consent wording and the policy version (K20), so
`CONSENT_POLICY_VERSION` stays `id-profile-pending-1` until then, and nothing waits
for that review. The Staff (Staf TU) surface
in the School shell waits for its navigation: the settings that hold the page are
open to the Owner and the Admin only (K31).
