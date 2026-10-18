# ADR 0034: A Guardian Reaches A Child Through A Verified Link, And Consent Is A Ledger

## Status

Accepted on 18 October 2026, by the orchestrator under the owner's standing
instruction to decide, verify, and record. It applies the owner's decisions K2
and K3 (approved 13 October 2026). Counsel review (K20) comes before the first
school. The Implementation Status table at the end says which parts are live.

Amended on 18 October 2026 for the age marker: the school roster keeps a flag that
a student is under the age limit, and no birth date (see Age). ADR 0015 and ADR
0027 follow it.

## Context

ADR 0012 says the Guardian role opens nothing by role, and a guardian reaches a
child only through a verified parent relation, which is planned. The relation has
two names in the repository today: the notification rules use `guardian`
(`notifications/rules.ts`), and ADR 0012 names it `verified parent`. The
`BuiltinRole` list keeps `guardian` for its label, "Orang tua".

ADR 0009 plans the parent's sign-in with a six-digit email code. The code is
valid five minutes, void after three wrong tries, and kept only as a keyed hash.
ADR 0027 allows that code to be the one code an email carries, and no other.

K2 (owner, 13 October 2026) says the school is the data controller, signing in is
not a child's consent, and a parent consents with an email code plus a second
check. The time, method, policy version, and checker are recorded. A student below
the age limit needs that consent before Nina, the class forum, and active grading.
Signing in does not count.

The consent ledger that exists is for analytics only. `consents/schema.ts` keys
it by user and by analytics category, so the guardian ledger is a new table
(`guardianConsents`) and the analytics ledger stays as it is.

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
   guardian's email address. The link is a row with the same 14-day expiry as an
   invite (GLOSSARY, Invite). Nothing is sent to a guardian who has no link.
2. The guardian signs in on the school host at `/orang-tua` with the six-digit
   code sent to that address. The code lives five minutes. Three wrong tries void
   it, and the same request limit as the sign-in applies.
3. The guardian enters the student's NISN, and the server compares it with the
   roster. The NISN is never shown back, and it is compared through the blind
   hash of the school key (ADR 0030, Blind word), so no plain NISN is read to
   check it.
4. When the roster has no NISN for the student, or the check cannot run, Staff
   verifies the link instead. The ledger then records the staff Person as the
   checker, with the method `staff`.
5. On success the server writes a `granted` consent row and the relation
   becomes active in the same transaction. It journals `guardian.linked`.

A mismatch leaves the link unverified. The guardian sees the same message as for
a wrong code, and Staff sees the mismatch in the link list. Nothing reveals
which of the two checks failed.

### The email code

- The code is six digits. Nakafa stores only an HMAC-SHA-256 of it, under the
  server secret and with a purpose label of its own, `guardian-code`, so a
  login-card hash and a guardian code never match (ADR 0009, Login card and Parent).
- The codes live in `guardianCodes`, which Nakafa writes itself. The Better Auth
  email one-time-code plugin is not used for guardian codes, so no plugin storage
  hook decides how a code is kept. That keeps the storage rule in code this
  repository owns (ADR 0009).
- `confect/emails` sends the code, and the email carries only the code and a
  general sentence (ADR 0027). A code row is deleted when the code is used or its
  link ends, and a sweep removes a code that has expired unused.

### The consent ledger

`guardianConsents` is append-only. A withdrawal is a new row, never an update.

| Field | Holds |
| --- | --- |
| `tenantId` | The school |
| `studentPersonId`, `guardianPersonId` | The two Persons of the relation |
| `action` | `granted` or `withdrawn` |
| `at` | The server time of the row |
| `method` | `code_nisn` for the email code and the NISN check, or `staff` for a manual check |
| `policyVersion` | The version of the signed consent rule of the country profile (ADR 0032). Until the profile is signed, a version constant in code, named for the profile it stands in for |
| `checker` | The Person who gave the check: the guardian for `code_nisn`, or the staff Person for `staff` |

A row holds IDs and codes only, never a name, an email address, or free text
(ADR 0016). Withdrawal applies at once: its row ends the relation in the same
transaction, and it journals `guardian.withdrawn`, which tells the school the
withdrawal is done (blueprint, Orang tua, requests).

### Age and the under-18 gate

- The age limit comes from the country profile (ADR 0032). For Indonesia it is
  under 18, which the profile reads from UU 35/2014 Pasal 1 angka 1 (a secondary
  copy until counsel confirms it, K20).
- No birth date is stored. The blueprint's Dapodik rule reads a birth date only as
  an age marker and does not store it (ADR 0015). The import compares the date
  with the limit, keeps the answer, and drops the date. The answer is one flag on
  the student's roster row, `underAgeLimit`. The import reads no NIK (K13).
- A roster row with no flag counts as under the limit, so the gate and quiet hours
  apply until the school sets the flag. Staff can set it by hand when a student is
  entered, and each roster import sets it again. A student who turns 18 keeps the
  flag until the next import. That errs toward consent and quiet hours, never away
  from them.
- The gate refuses a student under the limit who has no active `granted` row, with
  the typed refusal `ConsentRequired`. It applies to Nina, the class forum, and
  active grading. S8 implements it, and the grading slices check it when the policy
  names grading.
- Quiet hours follow the same flag. They are on for a student under the limit and
  for a student with no flag, and only the school's DPIA can relax them (ADR 0027).

### Notices and channels

- A guardian's push is for released grades and late tasks only. A guardian's
  email is a link, and it names no student, grade, or message (ADR 0027).
- A guardian gets no forum mention.

### Requests

- A report copy request and a data correction request reach Staff (Staf TU), who
  approves each one (blueprint, Orang tua, requests). Those requests are a later
  slice, so this ADR names only their owner.

## Consequences

- A guardian's power is one relation, which ends at once when the link or the
  consent ends. No role grants reach to the child, so a role change never widens
  a guardian's view.
- Every consent is a row with a time, a method, a policy version, and a checker,
  so a school can show which check admitted a guardian and under which rule.
- The roster's `underAgeLimit` flag is the only new age value. It sits on the
  roster row, has two readers (the gate and quiet hours), and leaves with the
  roster when the school leaves. No birth date is stored anywhere.
- Withdrawal cannot be undone by a click. A guardian who withdraws links again
  through the same verification, and the old rows stay in the ledger.

## Rejected Alternatives

- The Better Auth email one-time-code plugin for guardian codes. Its storage of
  codes is the plugin's, and the repository would depend on a behaviour it has
  not verified (ADR 0009 keeps the code's storage in Nakafa).
- A `guardian` relation with the role's name. The role grants nothing, so the
  relation name should say what the link is (ADR 0012).
- An update of the consent state in place. The ledger must show every change.
- Storing the birth date and computing the age at each check. The blueprint says
  the date is not stored, and one flag answers every question that the gate and
  quiet hours ask.
- The flag on the tenant person row. That row is shared by every role of a school,
  and the flag is a roster fact (ADR 0011).
- A guardian code accepted on nakafa.com. ADR 0009 accepts a parent's code only on
  the school host, at `/orang-tua`, so a code typed anywhere else finds nothing.

## What Stays Open

- The consent wording and the policy version for the first school, after counsel
  reviews the Indonesian rules (K20).
- The handling of a guardian who has several children in several schools. The
  relation is per school, and the parent home (blueprint, Orang tua) is undecided.

## Implementation Status

| Part | Status |
| --- | --- |
| The decision in this ADR | Recorded by S0 |
| `verifiedParent` relation and the link rows | Planned, S7 |
| `guardianCodes` and the email code at `/orang-tua` | Planned, S8 |
| `guardianConsents` and the NISN second check | Planned, S8 |
| The under-age flag on the school roster | Planned, with the roster import (ADR 0015) |
| The under-18 gate (`ConsentRequired`) | Planned, S8 |
| Guardian notices and the rename of the notification relation | Planned, S9 |
| Parent home, shared narratives, and requests | Planned, S10 |
