# ADR 0027: One Inbox Is The Source Of Truth For Notifications, And Push, Email, And Reminders Follow It

## Status

Accepted on 13 October 2026 with owner decision K10. The owner approved decisions
K1 to K20 on that day. Notifications are planned for program wave B
(ADR 0013 describes the waves). Nothing in this ADR is live. The repository has
no inbox table, no push code, and no service worker, and the only email it sends
is the welcome email (`packages/backend/confect/emails/welcome/internal.ts`).

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

ADR 0026 fixes what may leave the system: email carries only links (the parent's
sign-in code of ADR 0009 is the one exception), push carries only a notification
id and a general title, and the inbox of an account is served by the cell that
holds the account.

A mention is a different source. The message of ADR 0025 and the inbox row that
it causes are written in one transaction, and the journal does not record each
message (ADR 0016).

## Decision

### The inbox is the source of truth

- One table, `notifications` (planned). A row holds the recipient, the kind, the
  object it points to (an `ObjectRef`, ADR 0016), and the time. It holds no
  text. The title is read from the source when the row is opened, through the
  kind of the object, so the permission is checked every time and a sealed title
  is opened for its reader and for no one else (ADR 0030).
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
  production on 10 October 2026: on desktop nothing showed for 347 ms after the
  tap, while 13 chunks of 260 kB were loaded. That load after the tap is the
  cause this target removes, and the browser test measures the current figure.

### Two ways into the inbox

| Path | Kinds | How |
| --- | --- | --- |
| The transaction of the cause | Mentions and replies in a class | The mutation that writes the message (ADR 0025) also writes one row for each mentioned person and schedules the push. Convex schedules a function from a mutation only if the mutation commits, so a failed message leaves no row. |
| The consumer and the scheduler | Every other kind | The notify consumer reads published journal changes with its own cursor. The scheduler runs a reminder when it falls due. |

### The sending flow

The consumer and the scheduler feed the same rules. The rules decide who
receives what, on which channel, from the preferences of each member and the
quiet hours. They write the inbox row, then a workpool sends push and email.

- The consumer follows ADR 0016. It adds an index on the owner and the change
  type to `journalEntries`, reads in creation order with its own cursor
  (`journalCursors`, planned), checks permission again when it loads the
  subject, and proves its ordering assumption on Convex before it relies on a
  creation-time cursor. An entry holds IDs and codes, never a name or a message.
- Preferences are kept for each kind and each channel (`notificationPreferences`,
  planned). The email for an invitation and for the account is always sent.
- The fan-out is never one transaction. A workpool (`@convex-dev/workpool`, a
  dependency of `packages/backend` today) works in batches of 100 recipients.
  An `@all` of a teacher follows the same rule (ADR 0025).
- Push and email keep to the limits of ADR 0020: an attempt has a deadline of ten
  seconds, and a failure is repeated at most twice, after 500 milliseconds and
  one second (`NETWORK_ATTEMPT_DEADLINE`, `NETWORK_RETRY_SCHEDULE`, and
  `retryNetworkAttempt` in `packages/backend/client/network.ts`). Convex runs a
  scheduled action at most once and does not retry it
  (`docs.convex.dev/scheduling/scheduled-functions`, read on 13 October 2026), so
  the retry lives in the code that sends.
- A push action makes its own request, and `retryNetworkAttempt` repeats an
  attempt only where ADR 0020 says that is safe.
- The Resend component makes the email request and retries a failed batch in its
  own workpool. Its defaults are 5 attempts and a first backoff of 30 seconds
  that doubles (`@convex-dev/resend` 0.2.8, `src/client/index.ts`), and
  `confect/emails/client.ts` sets only `testMode` today. Its request carries no
  deadline (`callResendAPIWithBatch` in the package), which stays a known limit.
  The change that sends the first notification email sets `retryAttempts` to 3
  and `initialBackoffMs` to 500 for the one sender, the welcome email included:
  two retries after about 500 milliseconds and one second, because a workpool
  counts the first try as an attempt (`RetryBehavior` in `@convex-dev/workpool`
  0.4.14). A repeated request does not send an email
  twice, because the component dedupes on the idempotency key of the send and
  sends the id of the first email of a batch as the `Idempotency-Key` header
  (`src/component/lib.ts`).

### The journal changes that notify

A kind lists the change types it publishes (ADR 0016). These feed the consumer.

| Change | Origin | Used for |
| --- | --- | --- |
| `person.invited` | People and invitations | The invitation email, then the inbox after the person signs in. It joins the published list in the same change that adds the consumer. |
| `announcement.posted` | Class | The announcement in the inbox and in push, and an email when the teacher chooses |
| `assignment.published` | Class | A new task, then its deadline reminders |
| `assignment.deadlineChanged` | Class | Resets the deadline reminders |
| `assignment.missed` | Class, by the system | A late task, for the guardian |
| `grade.released` | Records | A released grade, for the student and the guardian |
| `sitting.scheduled` | Exams | The exam reminders, for the student and the guardian |

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
| An exam reminder, for a guardian | Exams | Yes | No | At 06:30 on the day of the exam, a link only |
| An invitation or the account | Invitations | Yes, after sign-in | No | Yes, always, a link only |

A guardian gets no forum mention. A guardian's push is for grades and late tasks
only, and a guardian's email is a link for grades, late tasks, exam reminders,
and invitations.

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
| Guardian's exam reminder | A sitting is scheduled. Journal cursor. | 06:30 on the day of the exam | Inbox, email |
| Daily digest | Email that is not sent yet. A cursor for each recipient. | 17:00 every day (proposal) | Email |

### Push

- Web Push is best effort. Its payload is the notification id and a general
  title, nothing else. Quiet hours skip it, and the inbox still holds the
  notification.
- On iPhone and iPad, push needs three things (WebKit, "Web Push for Web Apps on
  iOS and iPadOS", `webkit.org/blog/13878`, read on 13 October 2026). The site is
  a web app on the Home Screen, opened from its icon, whose manifest sets
  `display` to `standalone` or `fullscreen`. The system is iOS or iPadOS 16.4 or
  later. The person grants the permission in response to a tap. Without these steps, the inbox and the email
  still arrive. Behavior on later iOS versions is not tested. Push is offered
  only to a web app on the Home Screen, and a normal tab gets none. A browser
  test covers iOS 16.4 with the app on the Home Screen and a normal tab without
  push.
- Students, teachers, and guardians on iPhone get a step in their onboarding
  that leads from Safari to the Home Screen. The step writes no journal entry,
  because the inbox stays the source of truth.
- `apps/www/app/manifest.ts` already sets `display: "standalone"`. No service
  worker and no subscription code exist yet. The build adds both, with
  `pushSubscriptions` (planned). RFC 8030 section 7.3 makes a push service
  answer a send to an expired subscription with 404, and the sender deletes that
  subscription.
- `apps/www/playwright.config.ts` blocks service workers for every project today
  (`serviceWorkers: "block"`), so the push change gives its browser test a
  project that allows them, and it records how the iOS check runs.

### Quiet hours and time zones

- Quiet hours run from 21:00 to 06:00 in the school's time zone. They are on by
  default for an account under 18, and a school can relax them only as its data
  protection impact assessment (DPIA) allows.
- Quiet hours, reminders, and digests use the IANA time zone of the school the
  notification is about (ADR 0032). Instants are stored in UTC.
- The tests run in Asia/Jakarta and Europe/Berlin, and they include a change of
  daylight saving time.

### Email

- Every email is sent by `confect/emails`, the one sender. The notification
  module hands its payload to it, and so will the guardian module and sign-in.
- An email carries links and general sentences only. The one exception is the
  parent's six-digit sign-in code (ADR 0009, ADR 0026), which `confect/emails`
  sends as it sends the rest. A digest states counts for each kind and names no
  one, and its plural forms follow the CLDR rules of each language. Grades, the
  names of students, the text of messages, and exam tokens never enter an email.
- Each cell has its own Resend domain (ADR 0026). Each send has an idempotency
  key for the notification and the recipient, as the welcome email has one
  (`idempotencyKey` in `emails/welcome/internal.ts`).
- WhatsApp is the next channel and follows the same rules. It is planned.

## What Stays Open

- The sender of Web Push: the `web-push` package 3.6.7 (MPL-2.0), or RFC 8291 and
  RFC 8292 written in Effect. AGENTS.md prefers the Effect module that covers the
  job, and the protocol needs Web Crypto and an HTTP client. The push change
  decides, and it records the proof.
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
  hours stop only the push.
- A name, a grade, or a message text in a push or an email. A lock screen and a
  mailbox show them to people who are not the recipient (ADR 0026).
- An outbox copy of the journal for notifications. ADR 0016 rejects it.
- One scheduler for each reminder kind. One cron serves all of them, and a unique
  code for each reminder stops a double send.

## Implementation Status

| Part | Status |
| --- | --- |
| The welcome email through `confect/emails` and the Resend component | Live |
| `apps/www/app/manifest.ts` with `display: "standalone"` | Live |
| `notifications`, `notificationPreferences`, `notificationReminders`, `pushSubscriptions`, and `journalCursors` | Planned, program wave B |
| The notify consumer, and the published list with `person.invited` | Planned, program wave B |
| The reminder cron | Planned, program wave B |
| A service worker and Web Push | Planned, program wave B |
| The inbox panel and `nakafa.com/id/notifications` | Planned, program wave B |
| WhatsApp | Planned, after the first channels |
