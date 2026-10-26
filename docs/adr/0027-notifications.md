# ADR 0027: One Inbox Is The Source Of Truth For Notifications, And Push, Email, And Reminders Follow It

## Status

Accepted on 13 October 2026 with owner decision K10. The owner approved decisions
K1 to K20 on that day. Notifications are planned for program wave B
(ADR 0013 describes the waves). The invitation rows, the journal cursor, and its
sweep are built. The cursor passes only settled entries behind a commit-lag
window, so it needs no Convex ordering proof (ADR 0016), and the rest of the
notification system is not live either. The repository has no push code and
no service worker. It sends two emails: the welcome email
(`packages/backend/confect/emails/welcome/internal.ts`) and the
invitation email (`packages/backend/confect/emails/invite`), which the invite
mutation starts (ADR 0011).

Amended on 16 October 2026 after review: a reminder keeps its anchor and Timing
rather than its send instant, a notice rule holds one route for each relation, a
Chosen time belongs to email only, the guardian's exam reminder is the earlier of
06:30 and 30 minutes before the sitting opens, a reminder is sent only before its
anchor, quiet hours hold a push back until they end except for an exam start,
and quiet hours cover every student account while no age is stored.

Amended on 18 October 2026: the sitting change is `sitting.schedule`, the name
that the live scheduling writes (ADR 0016 keeps a stored change name), and
`grade.released` belongs to Records (ADR 0033). The Dapodik import sets an
under-age flag on the school roster and keeps no birth date, so quiet hours follow
the flag once it is set (ADR 0034).

## Context

A school produces notifications from many sources: a mention or a reply in a
class, an announcement, a task and its deadline, a grade, an exam, and an
invitation. Students, teachers, and guardians receive them, in one school or
several, in one time zone or another.

The journal already records the changes that matter, and a consumer reads the
published change types with a cursor of its own (ADR 0016). No consumer exists
yet. `journalEntries` has one index, `by_owner_tenantId`
(`packages/backend/confect/tables/journalEntries.ts`), and `person.invited` is a
change of the tenancy kind that its published list does not hold yet
(`packages/backend/confect/tenancy/kinds.ts`).

ADR 0026 fixes three limits: push carries only a notification id and a general
title, email is sent from the cell's own domain, and the inbox of an account is
served by the cell that holds the account. What an email may hold is decided
under Email below.

A mention is a different source. The message of ADR 0025 and the inbox row that
it causes are written in one transaction, and the journal does not record each
message (ADR 0016).

## Decision

### The inbox is the source of truth

- One table, `notifications` (planned). A row holds the recipient, the kind, the
  object it points to (an `ObjectRef`, ADR 0016), and the time. It holds no
  text. The title is read from the source when the row is opened, through the
  kind of the object, so the permission is checked every time and a sealed title
  is opened for its reader and for no one else (ADR 0030). A row reads like the
  activity list of Threads: who did what, and where.
- A school notification is addressed to a Person, because a Person is who
  belongs to a school (ADR 0011). A personal notification is addressed to an
  account.
- A row is never skipped. Quiet hours, a missing push subscription, and a failed
  email do not stop it from being written.
- Unread is one mark, a dot on the row. There is no number. Marking a row read
  is optimistic and rolls back on failure.
- The text of a row may break anywhere, so an address without spaces stays in its
  column, and a filter with no result shows a caption under the list. The
  browser tests of the inbox use worst-case data at 390 and 1440 px, in light and
  dark.
- A row is kept for 90 days, the period that K10 proposes. Deleting an account
  deletes the rows of the account and of the Persons it held.
- There is one inbox, at `nakafa.com/id/notifications` (ADR 0026), served by
  the cell that holds the account. Inside a school it opens as a panel on the
  right with a filter, "This school" or "All schools", and it has no second
  address. A personal notification never shows inside a school, "All schools"
  included. A click opens the tab it points to on the same host. The filters
  are the kinds: all, mentions, tasks, grades, announcements, exams, and
  invitations.
- The inbox opens in the first frame after the tap (target). A browser test
  measures it at 390 and 1440 px against the budget of the initial bundle. The
  Nina System Blueprint measured the same kind of panel, the Nina sheet, on
  production on 10 October 2026: on a desktop with fast Wi-Fi nothing showed for
  347 ms after the tap, while 13 chunks, 260 kB in all, were loaded. That load
  after the tap is the cause this target removes, and the browser test measures
  the current figure.

### Two ways into the inbox

| Path | Kinds | How |
| --- | --- | --- |
| The transaction of the cause | Mentions and replies in a class | The mutation that writes the message (ADR 0025) also writes one row for each mentioned person and schedules the push. The rows are in the same transaction, and Convex schedules a function from a mutation only if the mutation commits, so a failed message leaves no row and no push. |
| The consumer and the scheduler | Every other kind | The notify consumer reads published journal changes with its own cursor. The scheduler runs a reminder when it falls due. |

### The sending flow

The consumer and the scheduler feed the same rules. The rules decide who
receives what, on which channel, from the preferences of each member and the
quiet hours. They write the inbox row, then a workpool sends push and email.

- The consumer follows ADR 0016. It adds an index on the owner and the change
  type to `journalEntries`, reads in creation order with its own cursor
  (`journalCursors`), and checks permission again when it loads the subject. A
  mutation takes its entry's creation time while it runs, and the entry becomes
  visible at its commit, so the cursor does not rely on a proof of that order. It
  passes an entry only once the entry has settled, five seconds behind the clock,
  so an entry that commits late is still read. It holds each unsettled entry it
  handles early, at most one page of them with one slot kept free, until its
  position passes that entry, and it skips them when it reads again. A run that
  leaves entries unread schedules the next run: at once when the next entry has
  settled or the list has room for it, and for the moment the oldest unread entry
  settles otherwise. So a burst drains without the minute sweep. An invitation
  schedules a run only when its cursor is not pending already, so a burst starts
  one chain of runs. A cursor with nothing left to read is not pending. A cursor
  starts five seconds before the entry that makes it, not at a clock reading, so an
  invitation created up to that long before the entry gets a row, and an earlier
  one gets none. An entry holds IDs and codes, never a name or a message.
- An invitation has one inbox row for each recipient Person, found by the Person
  and the invitation. A resend refreshes that row to the resend's time and marks
  it unread. Revoking the invitation deletes the row, and a revoked invitation
  that a run reads later gets none.
- Preferences are kept for each kind and each channel (`notificationPreferences`,
  planned). The email for an invitation and for the account is always sent.
- The fan-out is never one transaction. A workpool (`@convex-dev/workpool`, a
  dependency of `packages/backend` today) works in batches of 100 recipients.
  An `@all` of a teacher follows the same rule (ADR 0025).
- Convex runs a scheduled action at most once and does not retry it
  (`docs.convex.dev/scheduling/scheduled-functions`, read on 13 October 2026), so
  a retry lives in the code that sends. Push and email are sent by different
  code, so each is decided apart.
- A push action makes its own request to the push service. The request is an
  HTTP POST, and only a 201 answer says that the push service accepted the
  message (RFC 8030 section 5). After a late answer the sender cannot know
  whether the message was queued, and a second send could show a second
  notification. A push is therefore a write that must not repeat, and its action
  sets its own limit beside its call, as ADR 0020 asks. An attempt has the
  deadline of ten seconds (`NETWORK_ATTEMPT_DEADLINE` in
  `packages/backend/client/network.ts`). It is repeated, at most twice, after 500
  milliseconds and one second (`NETWORK_RETRY_SCHEDULE`), and only after a
  failure that proves the request never reached the push service. A missed
  deadline and any answer of the push service end the send, so the action does
  not call `retryNetworkAttempt`, which repeats a missed deadline. A send that
  ends without a delivery loses one push, and the inbox still holds the
  notification.
- The Resend component makes the email request and retries a failed batch in its
  own workpool. Its defaults are 5 attempts and a first backoff of 30 seconds
  that doubles (`@convex-dev/resend` 0.2.9, `src/client/index.ts`), and the
  options in `confect/emails/client.ts` set only `testMode` today. Its request
  carries no deadline (`callResendAPIWithBatch` in the package), and the options
  of the component hold no setting for one (`ResendOptions`), so the deadline of
  ADR 0020 does not reach the email request. That stays a known limit. The
  change that sends the first notification email sets `retryAttempts` to 3 and
  `initialBackoffMs` to 500 for the one sender, the welcome and invitation emails
  included: two retries after about 500 milliseconds and one second, because a
  workpool counts the first try as an attempt, and the nth retry waits the first
  backoff times 2 to the power n minus 1 (`RetryBehavior` and the README of
  `@convex-dev/workpool` 0.4.14, the version in `pnpm-lock.yaml`). A repeated
  request does not send an email twice, because the component dedupes on the
  idempotency key of the send and sends the id of the first email of a batch as
  the `Idempotency-Key` header (`src/component/lib.ts`).

### The journal changes that notify

A kind lists the change types it publishes (ADR 0016). These feed the consumer.

| Change | Origin | Used for |
| --- | --- | --- |
| `person.invited` | People and invitations | The inbox row, which the account sees once it claims the Person. The invitation email is not sent from here: the invite mutation starts it through `confect/emails/invite` in its own transaction (ADR 0011). The change joins the published list in the same change that adds the consumer. |
| `announcement.posted` | Class | The announcement in the inbox and in push, and an email when the teacher chooses |
| `assignment.published` | Class | A new task, then its deadline reminders |
| `assignment.deadlineChanged` | Class | Resets the deadline reminders |
| `assignment.missed` | Class, by the system | A late task, for the guardian |
| `grade.released` | Records | A released grade, for the student and the guardian |
| `sitting.schedule` | Exams | The exam reminders, for the student and the guardian |

### Channels for each kind

Times marked as a proposal are proposals of the blueprint. The owner sets the
final times.

| Kind | Filter | Inbox | Push | Email |
| --- | --- | --- | --- | --- |
| A mention or a reply | Mentions | Yes | Yes, outside quiet hours | A daily digest at 17:00 (proposal) |
| A class announcement | Announcements | Yes | Yes | The teacher's choice for each announcement |
| A new task | Tasks | Yes | Yes, when it is published | The daily digest |
| A task deadline | Tasks | Yes | The day before at 16:00 (proposal) and one hour before | No |
| A released grade | Grades | Yes | Yes | For a guardian, a link only |
| A late task, for a guardian | Tasks | Yes | Yes | A link only |
| An exam starts | Exams | Yes | 15 minutes before | Yes, a link only |
| An exam reminder, for a guardian | Exams | Yes | No | At the earlier of 06:30 on the day of the exam and 30 minutes before the sitting opens, a link only |
| An invitation or the account | Invitations | Yes, after sign-in | No | Yes, always, a link only |

A guardian gets no forum mention. A guardian's push is for grades and late tasks
only, and a guardian's email is a link for grades, late tasks, exam reminders,
and invitations. In the Email column, a link only means the link and the general
sentence around it, and nothing that names a person or states a grade (see
Email).

### Reminders

One scheduler runs them: a cron every five minutes, like the try-out expiry sweep
in `packages/backend/confect/crons.ts`. A reminder is at most five minutes late
(target). Each reminder has a unique code, so a run that repeats never sends it
twice. A journal change creates the reminder rows (`notificationReminders`,
planned), and `assignment.deadlineChanged` replaces the rows of its task.

| Reminder | Trigger and cursor | When, in school time | Channels |
| --- | --- | --- | --- |
| Deadline, the day before | A task is published or its deadline changes. Journal cursor. | 16:00 on the day before the deadline (proposal) | Push, inbox |
| Deadline, one hour before | The same trigger | One hour before the deadline | Push, inbox |
| Exam starts | A sitting is scheduled. Journal cursor. | 15 minutes before the sitting opens | Push, inbox, email |
| Guardian's exam reminder | A sitting is scheduled. Journal cursor. | The earlier of 06:30 on the day of the exam and 30 minutes before the sitting opens | Inbox, email |
| Daily digest | Email that is not sent yet. A cursor for each recipient. | 17:00 every day (proposal) | Email |

A reminder is sent only while its anchor, the deadline or the opening it is
about, is still ahead. The sweep sends a due reminder when it reads it before
the anchor, and at once when its send instant had already passed when the row
was made, such as the day-before reminder of a task published after 16:00 on
that day. Once the anchor has passed, the reminder is dropped and writes
nothing, because a reminder after the fact tells nothing the task or the
sitting does not show.

### Push

- Web Push is best effort, and its payload is what ADR 0026 allows. Quiet hours
  hold a push back until they end (`confect/notifications/clock.ts` gives that
  instant), and the inbox holds the notification at once. An exam start is the
  one push that quiet hours do not hold, because it is about a sitting that
  opens in 15 minutes. A held push whose anchor has passed when quiet hours end
  is dropped, as a late reminder is (Reminders).
- On iPhone and iPad, push needs three things (WebKit, "Web Push for Web Apps on
  iOS and iPadOS", `webkit.org/blog/13878`, read on 13 October 2026). The site is
  a web app on the Home Screen, opened from its icon, whose manifest sets
  `display` to `standalone` or `fullscreen`. The system is iOS or iPadOS 16.4 or
  later. The person grants the permission in response to a tap. Without these
  steps, the inbox and the email still arrive. Behavior on later iOS versions is
  not tested. Push is offered only to a web app on the Home Screen, and a normal
  tab gets none. A browser test covers iOS 16.4 with the app on the Home Screen
  and a normal tab without push.
- Students, teachers, and guardians on iPhone get a step in their onboarding
  that leads from Safari to the Home Screen. The step writes no journal entry,
  because the inbox stays the source of truth.
- `apps/www/src/lib/seo/manifest.server.ts` already sets `display: "standalone"`. No service
  worker and no subscription code exist yet. The build adds both, with
  `pushSubscriptions` (planned). RFC 8030 section 7.3 makes a push service
  answer a send to an expired subscription with 404. Deleting the stored
  subscription after that 404 is this project's choice, and the RFC does not
  require it of the sender.
- `apps/www/playwright.config.ts` blocks service workers for every project today
  (`serviceWorkers: "block"`), so the push change gives its browser test a
  project that allows them, and it records how the iOS check runs.

### Quiet hours and time zones

- Quiet hours run from 21:00 to 06:00 in the school's time zone. They are on for
  every student account. The Indonesian profile puts them on for an account
  under 18 (ADR 0032), and no birth date is stored, so they cover every student
  until the school roster sets the under-age flag (ADR 0034). A school can relax
  them only as its data protection impact assessment (DPIA) allows.
- Quiet hours, reminders, and digests use the IANA time zone of the school the
  notification is about (ADR 0032). Instants are stored in UTC.
- A reminder stores its anchor and its Timing, not its send instant. The anchor
  is the real instant the reminder is about, such as a deadline or the opening of
  a sitting. The send instant is derived when the reminder is read, from the
  anchor, the Timing, and the zone of the school at that moment (`deliveryInstant`
  in `confect/notifications/delivery.ts`), so a change of zone moves every pending
  reminder with it. An instant stored when the reminder is scheduled keeps the
  zone it was made in. For example, a Jakarta reminder for 16:00 on the day before
  is stored as 09:00Z. Once the school's zone is Asia/Makassar, that instant fires
  at 17:00 WITA, while the rule fires at 16:00 WITA, which is 08:00Z.
- An archived unit sends no reminder and no digest. Its inbox rows stay readable,
  as ADR 0011 keeps an archived unit readable.
- The tests run in Asia/Jakarta, Asia/Makassar, and Europe/Berlin, and they
  include a change of daylight saving time.

### Email

- Every email is sent by `confect/emails`, the one sender, from the domain of the
  cell (ADR 0026). The welcome email and the invitation email already go through
  it. The notification module hands its payload to it, and so will the guardian
  module and sign-in.
- An email carries links and general sentences only, and this ADR owns that
  rule. The one exception is the parent's six-digit sign-in code, which ADR 0009
  decides and `confect/emails` sends as it sends the rest. A digest states counts
  for each kind and names no one, and its plural forms follow the CLDR rules of
  each language. Grades, the names of students, the text of messages, and exam
  tokens never enter an email.
- Each send has an idempotency key for the notification and the recipient, as the
  welcome email has one (`idempotencyKey` in `emails/welcome/internal.ts`).
- WhatsApp is the next channel and follows the same rules. It is planned.

## Decided With The First Build (26 October 2026)

- **Rows of a class.** `notifications` holds three kinds of row, told apart by
  `changeType`: an invitation (`person.invited`, with its invite and journal
  entry), a mention (`forum.mentioned`, with its message), and an announcement
  (`announcement.posted`, with its post). The subject of a class row is the class.
  The list reads each row's detail from its source when it is read, through the
  recipient's own access check: who did it, the class, and where in the class. A
  row whose source is gone, or whose class the recipient no longer reads, keeps its
  place without the detail.
- **Announcements fan out from their own transaction.** The post records
  `announcement.posted` in the journal and schedules the fan-out in the same
  transaction, the path that `@all` takes: one run writes the rows of one batch of
  100 Persons of the class roster, the students placed in its cohort and then its
  subject teachers, and schedules the next. Convex schedules the first run only if
  the post commits, so a failed post leaves no row. The journal entry stays for
  other consumers; the inbox does not read it, which saves a cursor and a second
  read of every post.
- **The push sender is Effect over Web Crypto** (`confect/notifications/webpush.ts`):
  RFC 8291 payload encryption in one aes128gcm record and an RFC 8292 VAPID token
  signed with ES256, sent once through `HttpClient` with the ten second deadline of
  ADR 0020 and never repeated, since no answer proves the push service did not
  queue it. A 2xx answer delivers, 404 and 410 forget the subscription, and any
  other answer or none is logged and dropped. The test decrypts the body as the
  browser does. No `web-push` package is added.
- **What a push carries.** The row's id, the title Nakafa, one general sentence of
  its kind in the language of the school's unit, and the address of the inbox. A
  push is scheduled only for a recipient whose account has a browser subscribed
  (`pushSubscriptions`, at most ten per account, the oldest dropped).
- **Quiet hours.** A recipient who holds a student grant has the push of a row
  held until 06:00 on the clock of the class's unit when the row comes between
  21:00 and 06:00 there; the row is in the inbox at once. A held push whose row is
  read by then is not sent.
- **The announcement email** goes to the recipients of each batch whose account
  has a real address, when the teacher chose email: one render in the Node runtime
  for the batch, then one message for each recipient keyed by the post and the
  recipient, so a repeated batch sends nothing twice. It carries the class's
  address on the school host and a general sentence (`packages/email/templates/notice`).
- **Operator secrets.** `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY` (the
  private scalar, Base64Url) and `WEB_PUSH_SUBJECT` (a `mailto:` address) on the
  Convex deployment. The browser reads the public key from the deployment
  (`notifications.push.publicKey`), so the web build holds no copy. Without them
  no browser is offered push and nothing is sent.
- **The browser.** `apps/www/public/sw.js` shows a push and opens the inbox on a
  press. The inbox offers push under its list after the person's tap, and an
  iPhone or iPad tab outside the Home Screen shows the Home Screen step in place
  of the offer.

## What Stays Open

- The sender of Web Push: the `web-push` package 3.6.7 (MPL-2.0), or RFC 8291 and
  RFC 8292 written in Effect. AGENTS.md prefers the Effect module that covers the
  job, and the protocol needs Web Crypto and an HTTP client. The push change
  decides, and it records the proof.
- Which transport failures prove that a push request never reached the push
  service. A refused connection (`ECONNREFUSED`), an unknown host (`ENOTFOUND`),
  and a network or host that is down or unreachable do. `NetworkRetryCodeSchema`
  also lists a reset (`ECONNRESET`), a broken pipe (`EPIPE`), and a socket
  failure (`UND_ERR_SOCKET`). A read may repeat after those, and a push may not,
  because the push service may have read the request before the connection
  broke. The push change chooses the set and tests that a late answer is sent
  once.
- The final times of the proposals in the tables, and the final period of an
  inbox row. The owner sets them (K10).

## Consequences

- A person who never puts the web app on the Home Screen gets no push on iPhone.
  The inbox and the email are what reaches everyone.
- The inbox holds one row for each recipient and each notification, for the
  period above. A page of the inbox reads the sources of its rows, so the page
  size is bounded when the inbox is built.
- A guardian reads no grade in an email. The link opens the inbox, where
  permission decides what the guardian sees.
- The mention and the reply path writes the inbox row in the transaction of the
  message, so a class post costs one extra write for each mentioned person, at
  most 20 (ADR 0025).

## Rejected Alternatives

- Push as the main channel. It is best effort, and iOS needs steps that not every
  person takes.
- Skipping the inbox in quiet hours. The inbox is the source of truth, and quiet
  hours hold back only the push.
- A name, a grade, or a message text in a push or an email. A lock screen and a
  mailbox show them to people who are not the recipient.
- An outbox copy of the journal for notifications. ADR 0016 rejects it.
- One scheduler for each reminder kind. One cron serves all of them, and a unique
  code for each reminder stops a double send.

## Implementation Status

| Part | Status |
| --- | --- |
| The welcome email through `confect/emails` and the Resend component | Live |
| The invitation email through `confect/emails/invite`, started by the invite mutation | Live |
| `apps/www/src/lib/seo/manifest.server.ts` with `display: "standalone"` | Live |
| `journalCursors`, which start five seconds before the entry that makes them, pass only settled entries, hold at most one page of handled ids with one slot kept free, and schedule their next run when a run leaves entries unread; and the index of `journalEntries` on the owner and the change type (creation time is its last column) | Built |
| `notifications`, one row for each Person and invitation (`by_recipientPersonId_and_inviteId`), with the purge of a released Person's rows and of a revoked invitation's row | Built |
| The invitation rows: `person.invited` is published, written by the invite, and refreshed by the resend; the inbox consumer writes them from the start of its cursor; an invitation revoked before its run gets no row, and a revoked invitation loses its row | Built |
| The bounds of the inbox: one request reads at most `HELD_SCHOOL_LIMIT`, 100 schools, and is refused past it with `NotificationScopeTooLarge`; each page of the consumer, the read-all, and the purge holds 50, half of the 100-entry list page of ADR 0016; a page cursor that names more than `HELD_SCHOOL_LIMIT` rows is refused with `NotificationCursorInvalid` | Live |
| The minute sweep that starts a run for each pending journal cursor | Built |
| `pushSubscriptions`, subscribe and unsubscribe, the push sender, and the push of mention and announcement rows held by quiet hours | Built; live once the operator sets the VAPID keys |
| `notificationPreferences` and `notificationReminders` | Planned, program wave B |
| The notify consumer for the change types other than `person.invited` | Planned, program wave B |
| The reminder cron | Planned, program wave B |
| The channel table as data, `confect/notifications/rules.ts`: the routes of each kind and relation | Called: the inbox consumer asks `deliveriesOf`, which reads `routeOf`, for the invitee's inbox row. `recipientsOf` and `canSwitchOff` wait for the preferences (program wave B) |
| The sends of a notice, `confect/notifications/delivery.ts`: `deliveriesOf` and `deliveryInstant` | `deliveriesOf` is called by the inbox consumer. `deliveryInstant` waits for the reminders, which need the zone of their school (program wave B) |
| The zone that carries a notice, `confect/notifications/zone.ts` | Built as pure functions, not called yet (program wave B) |
| The zone clock, `confect/notifications/clock.ts`: quiet hours, the 17:00 digest, and local send times in an IANA zone | Built as pure functions, not called yet (program wave B) |
| A service worker and Web Push | Built: `apps/www/public/sw.js` and the inbox's push offer with the Home Screen step |
| Mention rows written with their message, and announcement rows written by the fan-out, with their detail in the inbox | Built |
| The announcement email when the teacher chooses it | Built |
| The inbox panel and `nakafa.com/id/notifications`, the next reader of `notifications:list`, `notifications:read`, and `notifications:readAll` | Planned, program wave B |
| WhatsApp | Planned, after the first channels |
