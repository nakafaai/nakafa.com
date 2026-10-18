# ADR 0015: Google Connectors Are Read-Only Adapters Whose Tokens Are Sealed Under Their Owner's Key

## Status

Accepted on 13 October 2026 with owner decisions K2, K3, and K13. The owner
approved decisions K1 to K20 on that day. Planned for program wave B, after the
Google verification (risk R3 of the plan) for the scopes that need it.

No connector exists in the code today: `git grep` on main at `f8a5610808` finds
no connector module, table, or route, and no connector scope. The rule that
matches Classroom members stands only after its gate passes (see Gates).
Implementation Status lists each part.

## Context

A school's teachers and learners already keep files, forms, classes, and
calendars in Google. Connectors bring them into Nakafa as context for Nina and
as a way to set a school up without retyping a roster. The School program asks
for the least permission that does the job, a permission the owner can take back
at any time, and a strict split between a learner's own data and a school's
data, the split that K3 makes for memory.

Today Google is a sign-in provider only.
`packages/backend/confect/auth/runtime.ts` asks Google for offline access with a
forced consent prompt (`accessType: "offline"`,
`prompt: "select_account consent"`), asks for no scope beyond Better Auth's
defaults (`email`, `profile`, and `openid`), and Better Auth stores the tokens it
gets on the account row. ADR 0009 plans to stop storing them and says that a
connector token never sits there. Better Auth's Google provider also adds
`include_granted_scopes=true` to every sign-in request (`@better-auth/core`
1.6.33, `dist/social-providers/google.mjs`).

These rules of Google shape the design. Each was read on its own page on 13
October 2026, and References lists the pages.

- A sensitive scope needs a review by Google. Until the review passes, a user
  cap limits how many accounts can grant it to the app. A restricted scope needs
  a security assessment by a Google-approved assessor when the app stores the
  data on a server.
- A Workspace administrator controls which apps may use which scopes. In
  Education editions, a user designated as under 18 must ask for access to an
  app the administrator has not configured.
- A grant belongs to the Google Cloud project, not to a client. Revoking one
  token removes every scope the user granted to the project. An authorization
  that includes previously granted scopes carries all of them, whichever client
  asked for them.
- A redirect URI must match one registered for the client exactly, and it may
  not hold a wildcard.
- Classroom's default quota is counted per client, so every school shares it.

## Decision

### One seam: `confect/connectors`

A connector is an adapter in `confect/connectors`. The module's interface is
`manifest`, `connect`, and `sync`. A manifest says what the connector reads,
which scopes it asks for, and in which direction. `connect` makes a connection.
`sync` reads one page of the source. The provider's API is the seam: only the
adapter calls it. A new source adds an adapter and a manifest. It adds no token
table, no second vault, and no second audit path.

Nakafa writes nothing to Google, so every Google connector only reads. Every
scope below is a read scope except `drive.file`, which Google also lets change
the files that the user opened with the app. So the Drive adapter has no write
operation. Data that leaves Nakafa (webhooks, exports, grades sent to a learning
system) is not a connector, and ADR 0029 owns it. The one exception is the
Dapodik XLSX export, which Records owns (ADR 0033, see
below).

| Source | What it brings | Who connects | Status |
| --- | --- | --- | --- |
| Google Drive, through the Picker | Files the user picks, for a class library and for PDF import. A PDF without an answer key is marked for the teacher to complete. | A Google or Workspace account | Planned |
| Google Forms | The questions of the forms the user picks. A question without an answer key is marked for the teacher to complete before it is published. | A Google or Workspace account | Planned |
| Google Classroom | Classes, members, tasks, materials, announcements, and grades, as one import and then a sync | A teacher or an admin of a school Workspace; a student, for their own tasks and grades | Planned |
| Google Calendar | Upcoming events, for Nina and the home page | A Google account | Planned |
| Gmail | Email context | A teacher or a staff member, never a student | Planned, after the security assessment |
| Dapodik XLSX | A file the school uploads. Only the columns listed below are read. | A school in Indonesia | Planned |
| OneRoster CSV | A roster file that the school uploads. ADR 0029 owns the standard and lists what the import reads. | A school in any country | Planned |

- Dapodik has no official data API (K13). K13 has the owner send two written
  requests to the Ministry, one to become a partner for sign-in and one for the
  official data API. Until the Ministry signs and opens the API, the uploaded
  XLSX is the only path. When the API runs, the XLSX path is replaced in the same
  release. `confect/connectors` owns the import of the format, and Records owns
  the XLSX export of report data for Dapodik and e-Ijazah (ADR 0033).
- The Dapodik import reads a student's name, NISN, level, and class group name,
  and the date of birth only to set the student's under-age flag on the roster.
  The date is not kept (ADR 0034). It reads no NIK, no address, and no other
  column. The columns of each Dapodik version are recorded from a pilot school's
  export.
- A file import (the Dapodik XLSX, and the OneRoster CSV of ADR 0029) reads in an
  action, checks the file, shows a preview before it applies anything, and
  deletes the file once the import is applied or cancelled. For an XLSX file the
  checks are that its type is read from the content and not from the name, that
  no cell holds a formula, and that the columns match the list that is read.
  `confect/files` keeps the file (ADR 0028). The blueprint proposes 10 MB and
  5,000 rows as targets, to be measured with a pilot school's file. Applying an
  import is a journaled change, `roster.imported`, that holds the source and the
  number of rows added, changed, and skipped (ADR 0016).
- One XLSX library serves import here and the exports of ADR 0029. The
  blueprint lists `xlsx` and `exceljs`. The `xlsx` package on npm ends at 0.18.5,
  and SheetJS's documentation names its own CDN as the source of newer
  releases, so the choice is made with the install, after `pnpm security:audit`
  and a license check.
- The blueprint's table of standards lists grades going out to Google Classroom.
  No scope in the approved list can write them: Google describes
  `classroom.coursework.students` as managing student coursework and grades.
  Writing grades back is a new decision with its own scope and its own review,
  and until then Classroom is a source only.
- Microsoft Graph Education, Clever, and ClassLink come later through the same
  seam. ADR 0029 lists the standards.

### Two kinds of connection

A connection is one connector authorized by one owner.

- A **personal connection** belongs to one account. Its token is sealed under
  that learner's key. It reaches anything of a school only when the learner
  allows it, as the Insight section of the blueprint says for Classroom and
  Calendar data, and the learner can take that permission back at any time. The
  learner also disconnects at any time.
- A **school connection** belongs to one school. An Owner or an Admin makes one,
  and a Teacher may make their own. Its token is sealed under the school key
  (ADR 0030). It feeds the school's classes.

A school thread reads school connections only, and a personal thread reads
personal connections only, the same split that K3 makes for memory. An Admin
turns each connector on for the roles that may use it, and the Student role can
never be given Gmail. A connection lives in the data cell of its owner
(ADR 0026): a school connection is stored in the school's deployment, and a
personal connection in the account's home cell.

A student under the age limit of the country profile gets Nina, the forum, and
grading only after a parent's consent is recorded (K2, ADR 0032). A connection
exists to feed Nina, so such a student can make none until then.

A connection is active or in the `reconnect` state. It enters `reconnect` when
Google refuses its token, for example because the user took access away in their
Google account, or when the account of the member who made a school connection
is deleted (ADR 0030). It never disappears silently, and it shows its state to
its owner and to the Admins of its school.

### Scopes

A prefix of `https://www.googleapis.com/auth/` is dropped from every scope name.
Google's class is the class on Google's page where the page gives one.

| Connector | Scopes | Google's class | For |
| --- | --- | --- | --- |
| Drive | `drive.file` | Non-sensitive | Files the user chooses in the Picker |
| Forms | `forms.body.readonly` and `forms.responses.readonly`, candidates | No class on the pages read. The Data Access panel shows it. | Questions and responses of the chosen forms |
| Classroom, teachers and admins | `classroom.courses.readonly`, `classroom.rosters.readonly`, `classroom.coursework.students.readonly`, `classroom.courseworkmaterials.readonly`, `classroom.announcements.readonly`, `classroom.topics.readonly`, `classroom.student-submissions.students.readonly` | No class on the pages read. The Data Access panel shows it. | Import and sync, grades included |
| Classroom, students | `classroom.coursework.me.readonly` and `classroom.student-submissions.me.readonly` | Same | The student's own tasks and grades |
| Classroom, invitations | `classroom.profile.emails` | Same | The email of members who do not match yet, only to invite them |
| Calendar | `calendar.events.readonly`, candidate | Sensitive: Google names reading Calendar events as an example | Upcoming events for Nina and the home page |
| Gmail | `gmail.readonly`, candidate | Restricted | Email context of teachers and staff |

- A connection asks for the scopes of its own connector only, and only when a
  user turns that connector on. It takes the narrowest scope that works. Forms
  tries `drive.file` first, because Google's `forms.get` and
  `forms.responses.list` accept it, and falls back to the Forms scopes only if a
  test with a picked form fails.
- No connector request sets `include_granted_scopes`. With it, the new token
  carries every scope the user ever granted to the project, so a school
  connection's token could read a personal Gmail connection. Each connection gets
  a token that covers its own scopes.
- Connectors use a Google Cloud project of their own, with their own OAuth
  client and consent screen. Sign-in keeps the project it has and never asks for
  a connector scope (ADR 0009). Three facts decide it. Better Auth sends
  `include_granted_scopes=true` with every sign-in request, so a sign-in in a
  shared project would carry every connector scope the user granted. A
  revocation removes every grant of the project, so a connector's revocation
  would reach sign-in. The consent screen and its verification belong to the
  project, so sign-in would sit behind a sensitive-scope review. With two
  projects, none of the three crosses.
- Each connection runs the authorization code flow with PKCE, method S256, which
  Google's discovery document lists.
- The callback address is one fixed address per data cell. Google registers
  redirect URIs exactly and allows no wildcard, so a host per school cannot be
  registered. The return to the school host travels in `state`, which the
  callback checks against the session. The callback builds the return address
  from the school's slug and takes no address from a parameter, so it cannot
  redirect elsewhere. Sign-in already returns through the apex domain of the
  cell (ADR 0011), and the callback follows it.
- Tokens are sealed in `confect/vault` under the key of the connection's owner:
  the learner's key for a personal connection and the school's key for a school
  connection (ADR 0009, ADR 0030). The same key seals a Calendar mirror and a
  Drive copy. There is no second vault for connectors. The client never receives
  a refresh token or a stored access token. The Drive Picker is the one
  exception to the access token: Google's Picker takes a token in the page. So
  the browser receives a short-lived access token that covers `drive.file` only,
  and Nakafa does not store it.

### Google verification

A connector waits for Google's review exactly when one of its scopes is
sensitive or restricted.

- Drive does not wait: `drive.file` is non-sensitive.
- Calendar waits: it is sensitive.
- Gmail waits for the security assessment. It repeats at least every 12 months,
  and Google states no price.
- The plan's verification step lists the Classroom and Calendar scopes as
  sensitive, and its risk R3 expects only the member email and Calendar to wait,
  because members match by Google account ID and not by email. Google's pages
  give no class for any Classroom scope, so the Data Access panel decides. The
  import waits for every scope that the panel shows as sensitive, as Calendar
  does. The same check applies to the Forms scopes. The privacy policy of the
  Aksara release `edadc28a9d` already gives the class of one scope: line 205 of
  `en.mdx`, `de.mdx`, and `id.mdx` in `packages/corpus/pages/privacy-policy`
  says that Google classes the Classroom email access as sensitive. None of
  Google's pages in References shows that.
- Until the review passes, Google's help page on unverified apps limits an app to
  100 new users. That is enough for a test with a pilot school and no more.

Google asks for a justification for each sensitive scope, a video that shows how
a user starts and grants access, a verified domain, a public home page, and a
privacy policy on the same domain. It states that a sensitive review typically
takes 3 to 5 business days. The plan treats the whole process as a risk of
weeks. The request is for the connectors project. It is a wave A step, filed
after the demo video exists and running in parallel with the build. No connector
reaches production before every scope it asks for is non-sensitive or verified.
The privacy policy, published from Aksara, describes each connector as a plan
until it goes live, because Google requires an app to limit its use of Google
user data to what its privacy policy discloses.

### Workspace administrators

For Education Fundamentals, Standard, Plus, and the Teaching and Learning
Upgrade, a user designated as under 18 must request access to an app that the
administrator has not configured (Google Workspace Updates, 24 August 2023). An
administrator configures an app, found by its name or its OAuth client ID, under
Menu, Security, Access and data control, API controls, Manage App Access. The
levels are Trusted, Limited, Specific Google data, and Blocked. A separate
setting lets users sign in to apps that ask only for the basic information that
Sign in with Google needs. Google names the error that follows a refusal
`admin_policy_enforced`.

- The setup flow (ADR 0026, `/setup`) carries a guide for the school's Workspace
  administrator. It gives the client ID of sign-in and the client ID of the
  connectors project, the access level to choose, and the scopes of each
  connector the school turns on. For sign-in alone, the basic information
  setting may be enough. For a connector, the administrator marks the connectors
  client Trusted, or Specific Google data with that connector's scopes. The
  guide is checked against the console before each release, because Google
  renames its labels.
- For belajar.id the blueprint says the administrator may sit at the Ministry.
  No Ministry source was checked. So the guide asks the school owner to confirm
  who runs the domain first. The file imports (Dapodik XLSX, OneRoster CSV) do
  not depend on Google.
- When Google ends a connect with `admin_policy_enforced`, Nakafa makes no
  connection, tells the user that the school's administrator has not allowed
  Nakafa for this account, and shows the guide to an Admin. A learner whose
  sign-in meets it uses the login card (ADR 0009).
- The error name comes from Google's OAuth documentation. That an under-18
  Workspace account receives it for an unconfigured Nakafa has not been tested
  on a Workspace account, and the test is a gate.

### Classroom members

| From Classroom | To Nakafa | Rule |
| --- | --- | --- |
| Class, by its ID | A class (Section), for example Mathematics X-1 | One `connectorLinks` row for each Google class |
| Student, by user ID | The Person whose Google subject is the same | They match when the IDs are equal. Without a match the member goes on the invitation list. |
| Teacher, by user ID | A member of the class who holds the teacher relation | The same rule |
| Member email | Invitations only | An email never matches a member |

ADR 0009 matches a school account by its Google issuer and subject. Better Auth
takes a Google user's ID from the `sub` of the ID token (`@better-auth/core`
1.6.33, `dist/social-providers/google.mjs`) and stores it as `accountId` beside
`providerId`, with an `accountId_providerId` index
(`packages/backend/components/betterAuth/schema.ts`). Google tells the
application to use `sub` as the key of a user and not the email, which can
change. A learner who never signs in with Google stays on the invitation list,
and an invitation claim is the one place a verified email matches an account
(ADR 0009, ADR 0011).

Classroom's reference describes a profile `id` only as the "Identifier of the
user". Nothing in Google's pages says it equals the OIDC `sub`, so the rule is
gated.

### Sync and quota

Google's default Classroom limits are 4,000,000 queries per day and 3,000 per
minute for each client, and 1,200 per minute for each user (read 13 October
2026; Google says they can change). The client limits are shared by every school.

- A sync is a series of actions, one page each, with the writes in internal
  mutations. A query or a mutation may run user code for about a second
  (docs.convex.dev/production/state/limits), so a long job is a chain of
  resumable pages. A connection queues its next page when the previous one
  completes, so it holds at most one page in the pool.
- Polling is adaptive: a source that changed is read again sooner, and a quiet
  one later. The intervals are targets, measured with a pilot school. Google
  also offers push notifications for Classroom, and its limits page tells an app
  that polls to consider them where an endpoint offers them. They need the
  `classroom.push-notifications` scope and a Pub/Sub topic, and they are a
  separate decision.
- The work runs in one workpool of its own, shared by every school.
  `convex.config.ts` declares no standalone pool today. The pools that exist
  take 28 between them: the one inside `@convex-dev/workflow` takes 20
  (`packages/backend/confect/workflow.ts`), and the two inside
  `@convex-dev/resend` 0.2.8 take 4 each (`src/component/lib.ts`). The workpool
  README asks that the `maxParallelism` of all workpools and workflows together
  does not exceed 100 on Pro, so the pool of the connectors takes a value within
  what the others leave. That value is the most pages that run at once.
- Fairness between schools is a cap on the pages that one school has in the
  pool, queued or running. The pool starts pending work in the order it was due,
  in steps of 100 ms (`@convex-dev/workpool` 0.4.13, `src/component/loop.ts`,
  `lib.ts`, and `shared.ts`), and its README names no key, priority, or
  parallelism for each key. So one pool cannot keep a page of one school from
  waiting behind the pages of another, and the cap bounds how many pages can
  stand ahead of it. The mutation that queues a page counts the pages of its
  school through an indexed read that stops at the cap, and queues nothing at
  the cap. A connection refused at the cap stays due and tries again on the
  next pass. This replaces the plan's workpool per tenant (R10), for the
  reasons under Rejected Alternatives.
- The Google requests a minute are about
  `60 * maxParallelism * requestsPerPage / secondsPerPage` at most, and
  `maxParallelism` is set so that this stays under 3,000, the client limit, with
  a margin. Under steady load the daily limit comes first, because 4,000,000 a
  day is under 2,800 a minute on average. A connection runs one page at a time,
  so it sends about `60 * requestsPerPage / secondsPerPage` a minute at most.
  Google counts the 1,200 a minute for a user, which is a Google account, so the
  connections of one account share it, and a page is sized so that they stay
  under it.
- The first page of a school starts after about
  `otherSchools * cap * secondsPerPage / maxParallelism` seconds at most, where
  `otherSchools` counts the schools that have pages in the pool. The cap is the
  largest value that keeps this within the start delay that the pilot school
  accepts. The workpool reports the delay between queueing and start when its
  `logLevel` is `INFO` (README).
- None of these values is measured yet. `requestsPerPage` and `secondsPerPage`
  are measured with the pilot school, and the cap and `maxParallelism` are
  targets set from them.
- A retryable Google error, such as `RESOURCE_EXHAUSTED`, is retried with
  exponential backoff, as Google advises. The workpool's retry adds jitter.
- A user can start a sync by hand. The request passes the rate-limit component
  and then the cap, so a button cannot use up the quota.
- Every Google request has a deadline (ADR 0020).

### Disconnect and delete

| Event | What happens |
| --- | --- |
| A connection is disconnected, by its owner or by an Admin of its school | Its stored tokens are destroyed, and the grant at Google is revoked as the revoke rule below says. The imported data is deleted or kept, as the owner chooses. |
| The Calendar mirror | It is always deleted. |
| A Drive copy | It is kept only when the owner chooses to keep it. |
| A member leaves the school | The Google grant belongs to the Google account of the member who made the connection, so that member chooses. The connection is transferred to them and sealed again under their learner key, or it is disconnected. The imported data stays with the school (ADR 0030). |
| The account of the member who made a school connection is deleted | The connection stays and enters `reconnect`. Its stored tokens are destroyed, and the grant at Google is revoked as the revoke rule below says. The imported data stays with the school, which controls its records (ADR 0011). Someone reconnects it with a Google account of their own (ADR 0030). |
| A learner deletes their account | Each personal connection of the learner is disconnected first. Its stored tokens are destroyed, the grant at Google is revoked as the revoke rule below says, and its imported data is deleted, because the learner key that seals it is shredded with the account. The disconnect has to come first: revoking needs the token, and `packages/backend/confect/auth/cleanup/impl.ts` shreds the key after every row it sealed. A school connection that the learner made follows the row above. |
| A school leaves Nakafa | Every school connection is disconnected before the school key is destroyed, and the school receives a deletion record (ADR 0030). |
| A school moves to another data cell | Every school connection is disconnected before the export. Its imported data moves with the school, except a Calendar mirror, which is always deleted. No token crosses cells, because accounts stay in their home cell and the maker of a connection has no account in the target cell (ADR 0026). The school connects again there. |
| Each step | It is journaled (ADR 0016). The entry holds IDs and reason codes, never the Google email or a class name. |

**The revoke rule.** Revoking one token at Google removes every scope the user
granted to the project and invalidates the tokens of every client in it. A blind
revoke would end the other connections of the same Google account, so Nakafa
revokes only with the last one. Until then the grant stays in the user's Google
account, and the connector page says where to remove it. The count spans the
personal and the school connections of one Google account. The connector change
decides how it finds them, and it must not show one owner's connection to
another owner.

### Nina and Google data

A school thread and a personal thread read different connections, as the section
Two kinds of connection decides.

- Nina reads the synced copy in Convex. She does not call Google on each turn.
- Google data is used for the feature the user asked for. It is not used for
  ads, and it is not used to train a general model. It goes only to the
  providers that the feature needs, and the privacy policy lists them. Gmail is
  never used for students. The basis is Google's API Services User Data Policy
  and its Workspace API user data policy, which the privacy policy of the Aksara
  release `edadc28a9d` already names (line 211 of
  `packages/corpus/pages/privacy-policy/en.mdx`).
- Google data reaches a model only in a language call, which sends `zdr: true`
  and `data_collection: "deny"` (ADR 0019). A connection copy is not embedded,
  because an embedding request sends `zdr: true` alone, and ADR 0019 says
  embeddings carry published lesson and Quran text and a search phrase, never a
  stored learner message. A Drive file is indexed for search only after a
  teacher publishes it to a class library, and then ADR 0023 governs it.
- Nina never writes to Google.

## Gates

- **Classroom member ID.** A test with an account shows that the user ID that
  Classroom reports for a member equals the OIDC `sub` of that account. The
  matching rule is built only after it passes. If it fails, a new decision
  replaces the section Classroom members.
- **Scope classes.** The Data Access panel of the Cloud console shows the class
  of every scope before the verification request is filed, and the privacy
  policy is changed to say what the panel shows.
- **School fairness.** On the pilot setup, school A fills its cap and school B
  starts one sync. The first page of B starts within the wait, and the Google
  requests of the run stay under the rate, that the formulas in Sync and quota
  give for the chosen values. If either fails, a new decision replaces the cap.
- **Forms with `drive.file`.** A form chosen in the Picker is read with
  `drive.file` alone, or Forms falls back to its own scopes.
- **Workspace under 18.** A Workspace for Education account under 18 meets
  `admin_policy_enforced` for an unconfigured Nakafa, and the guide unblocks it.
- **Demo video.** The consent flow runs against test accounts in the connectors
  project before the request is filed.

## Consequences

- A new source costs one adapter and one manifest. It needs no table for tokens,
  no vault, and no audit table.
- A school sees no Google write from Nakafa, and Google's scopes are the
  narrowest that work. The cost is that a Drive scope can still write, so the
  read-only rule for Drive rests on the adapter and its review.
- A second Google Cloud project means a second consent screen and a second
  verification. Sign-in does not wait for them, and a connector's verification
  state, user cap, or revocation never reaches sign-in.
- A disconnect can leave the Google grant in place, as the revoke rule says. The
  tokens are gone from Nakafa at once.
- Calendar and Gmail may reach production later than Drive, and Classroom
  depends on the panel's classes.
- Every school shares Classroom's client quota and the one pool. The cap bounds
  how long one school can delay another, and it does not remove the delay.
- A student who never signs in with Google stays on the invitation list of a
  Classroom import.

## Rejected Alternatives

- Incremental authorization with `include_granted_scopes`. It puts every scope
  a user ever granted into each new token.
- One Google Cloud project for sign-in and connectors. Better Auth's sign-in
  request would carry the connector scopes, a revocation would reach sign-in,
  and sign-in would sit behind the verification.
- A second vault for connector tokens. The vault is the one place that seals
  text under an owner's key.
- Storing tokens on the Better Auth account. ADR 0009 stops that.
- Matching Classroom members by email. Google says an email can change and is
  not a stable key.
- A workpool for each school. A pool is a component that is declared when the
  app is deployed, so signing a school cannot create one. The workpool README
  also asks that all pools together stay under a `maxParallelism` of 100 on Pro,
  and it says each pool adds overhead, so many pools do not fit.
- Always revoking at Google on disconnect. The revoke rule gives the reason.

## Implementation Status

| Part | Status |
| --- | --- |
| Google sign-in with offline access and a forced consent prompt (`packages/backend/confect/auth/runtime.ts`) | Live. ADR 0009 plans to stop storing its tokens. |
| Learner key in `confect/vault` (`vaultKeys`) | Live |
| School key (`tenantKeys`, ADR 0030) | Built, program wave B |
| `confect/connectors`, `connectorLinks`, `connectorSecrets` | Planned, program wave B |
| The Drive, Forms, Classroom, Calendar, and Gmail adapters | Planned, program wave B. Each reaches production as Google verification says. |
| The connector pages: connect, disconnect, reconnect, sync by hand, and the Admin's switch for each role (ADR 0026 has the school address) | Planned, program wave B |
| A Google Cloud project for connectors, and its verification request | Planned, program wave A step |
| A standalone workpool for connectors, and the cap on the pages of each school in it | Planned. None exists today. |
| Workspace guide in the setup flow | Planned |
| Dapodik XLSX import and export, and the file import checks (the OneRoster CSV import of ADR 0029 uses them too) | Planned |

## References

- Google, OAuth 2.0 for Web Server Applications
  (developers.google.com/identity/protocols/oauth2/web-server): offline access,
  incremental authorization, token revocation, redirect URI rules, and the
  `admin_policy_enforced` error.
- Google OpenID configuration
  (accounts.google.com/.well-known/openid-configuration): the PKCE methods and
  the endpoints.
- Google, sensitive scope verification and restricted scope verification
  (developers.google.com/identity/protocols/oauth2/production-readiness), and
  Google Cloud Help, unverified apps (support.google.com/cloud/answer/7454865).
- Google, Gmail scopes (developers.google.com/workspace/gmail/api/auth/scopes)
  and Drive scopes
  (developers.google.com/workspace/drive/api/guides/api-specific-auth).
- Google, Classroom authorization
  (developers.google.com/workspace/classroom/guides/auth), the user profile
  reference, the Classroom limits page, and the Classroom push notifications
  guide.
- Google, OAuth 2.0 scopes for Google APIs
  (developers.google.com/identity/protocols/oauth2/scopes), read 14 October
  2026: its Classroom list gives no class to any scope.
- Google, the Forms `forms.get` and `forms.responses.list` references, on the
  scopes they accept.
- Google, OpenID Connect
  (developers.google.com/identity/openid-connect/openid-connect): `sub`, `hd`,
  and the email claim.
- Google Workspace Updates, 24 August 2023, third-party app access for
  Education, and Google Workspace Admin Help, the page on controlling which apps
  access Workspace data.
- Google, API Services User Data Policy and the Workspace API user data policy.
- Google, the Picker overview.
- `@convex-dev/workpool` 0.4.13 README, on pools, `maxParallelism`, retries, and
  the start delay, and its `src/component` files `loop.ts`, `lib.ts`, and
  `shared.ts`, on the order of starts. `@convex-dev/resend` 0.2.8,
  `src/component/lib.ts`, on its two pools.
- Convex limits (docs.convex.dev/production/state/limits).
- `@better-auth/core` 1.6.33, `dist/social-providers/google.mjs` and
  `dist/oauth2/create-authorization-url.mjs`: the scopes, the PKCE method, the
  `include_granted_scopes` parameter, and the user ID.
- npm registry on 13 October 2026: `xlsx` 0.18.5 (Apache-2.0) and `exceljs`
  4.4.0 (MIT) are the latest releases.
- The privacy policy of the Aksara release `edadc28a9d`
  (`packages/corpus/pages/privacy-policy/en.mdx`), on the Google data policies.
- ADR 0009, 0011, 0012, 0016, 0019, 0020, 0023, 0026, 0028, 0029, 0030, and 0032.
