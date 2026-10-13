# ADR 0025: A Class Holds Channels, Numbered Discussions, And Tasks, Built On The Chat Primitives Of Nina

## Status

Accepted on 13 October 2026 with owner decisions K3, K10, and K11. The owner
approved decisions K1 to K20 on that day. This ADR replaces ADR 0005. The
classroom module, `confect/classroom`, is planned for program wave B (ADR 0013
describes the waves). The first School's forum is retired in the releases of ADR
0011: its web app, forum viewport included, is gone from main (#1051), and its
backend stays until the contract release deletes it (K11). The design-system
parts that the forum uses are live, except the ones its table marks as planned.

## Context

ADR 0005 recorded an Effect-owned viewport for one conversation of the first
School's forum. The contract release of the retirement (ADR 0011) deletes that
ADR with the backend of the forum, and this ADR takes its place. Git keeps the
old text (`git show ac134a0819:docs/adr/0005-forum-viewport.md`). The first
School's forum worked like this. The backend facts were read on main at
`f8a5610808` on 13 October 2026, and the web facts at `ac134a0819`, the commit
before #1051 deleted the web app:

- Its threads are in `schoolClassForums` and its posts in `schoolClassForumPosts`
  (`packages/backend/confect/tables`). The body of a post is a plain string
  (`packages/backend/confect/classes/schema.ts`).
- A post takes at most 20 mentions, stored as user IDs (`MAX_FORUM_POST_MENTIONS`
  in `packages/backend/confect/classes/forums/constants.ts`). No notification
  follows a mention: `git grep` finds no inbox and no notification under
  `packages/backend/confect/classes`.
- Its viewport was 38 files under
  `apps/www/components/school/classes/forum/conversation` (33 in `viewport` and 5
  in `data/scroll`, 15 of them tests, counted with `git ls-tree`), and its
  transcript used Virtua. Main holds none of these files now.

K11 deletes all of it, in the releases of ADR 0011, before the new School is
built. The new School needs a class that is not a school identity (ADR 0011),
numbered discussions, messages sealed with the school key (ADR 0030), mentions
that reach the inbox (ADR 0027), files (ADR 0028), tasks, and one scroller that
Nina's chat also uses.

The design system already holds Nina's chat primitives: `Message`,
`MessageContent`, and `MessageFooter` (`message.tsx`), `Bubble` and
`BubbleContent` (`bubble.tsx`), `Attachment` and its parts (`attachment.tsx`),
and `MessageScroller` and its parts (`scroller.tsx`), over `@shadcn/react` 0.3.1.
`apps/www/components/ai/transcript.tsx` composes them for Nina with `autoScroll`
and `defaultScrollPosition="last-anchor"`.

## Decision

### A class and its parts

A class is the place of one subject for one group. Tenancy owns the school, its
units, its periods, its cohorts, and the Person (ADR 0011). The classroom module
owns the roster of a class, its forum, its library, its tasks, and its read
state. It replaces `confect/classes` and `confect/schools`. Each part has its
own address (ADR 0026).

| Part | What it holds | Status |
| --- | --- | --- |
| Home | Announcements with attachments, polls, scheduled posts, pins, and automatic posts from tasks and exams. Reactions and comments. "Discuss" opens a discussion with the post as its reference. The cover, the accent colour, the teachers, and the next session sit on top. The class post owns the content of an announcement (ADR 0028). | Planned |
| Forum | A general channel for every member, then topic channels. A discussion opens in the right panel, and as a full screen on a phone. Reactions, forward, edit, pin, and search. | Planned |
| Library | Folders, previews of PDF files and images, links, and Nakafa material as references. An upload or a pick from Google Drive (ADR 0015). Limits for each school, and a large video as a link (ADR 0028). | Planned |
| Tasks | Submissions, a quiz or an exam from the assessment engine (ADR 0031), practice and Nakafa material with the context of the task, and an import from Google Classroom (ADR 0015). A deadline, a rule for late work, points, a grade category, and a target of part of the class. A finished material is recorded on its task. | Planned |
| People | Animal avatars. A student only reads. A teacher manages the members of their own classes from the school roster and creates no accounts, and inviting people to the school stays with the Admin (ADR 0012). Members sync from a cohort, OneRoster, or Google Classroom. A profile opens in the right panel: identity, cohort, guardians, tasks, grades, and a summary of Insight. | Planned |
| Grades | A grid of students against tasks and exams, with an export. A teacher releases the grades of their own tasks and exams (ADR 0012). Report cards belong to the records module. | Planned |
| Settings | The settings below. | Planned |
| Live class link | A Meet link for each session. The teacher records attendance. | Planned |
| LiveKit embed | Later, at the same seam, after Meet works. | Planned |

A student reads and writes in the classes they belong to, and a teacher in the
classes they teach, through the Class member and Subject teacher relations (ADR
0012). Owners, Admins, Principals, and Deputies can read the posts, the forum,
and the library of every class their grant covers, and they write nowhere in
them (a roles-granted view action, ADR 0012). Counselors, Staff, Proctors,
Auditors, and Integrations have no access to them. A guardian does not read the
forum. The verified parent relation opens tasks, grades, report cards, and
announcements. A student under the age limit of the country profile (ADR 0032)
uses the forum, and Nina in it, only after a parent's consent is recorded (K2).
Signing in does not count as consent (ADR 0009).

### Channels and numbered discussions

- A channel is a named place in the forum, and a row of `classroomChannels`
  (planned) with its name and its class. Every class has a general channel for
  all its members, and a teacher adds topic channels. A message belongs to one
  channel. A message without a title is a message in the channel.
- A discussion starts with a titled message. It has a number that counts per
  class, like the number of an issue, and an address such as
  `harapan.nakafa.com/classes/fisika-x-1/forum/12` (ADR 0026). The mutation that
  opens a discussion takes the number from a counter that only discussions
  write, in the same transaction that inserts the discussion, so two discussions
  of one class never share a number.
- The replies to a discussion are its thread. The thread opens in the right
  panel, and as a full screen on a phone.
- The title of a discussion is the same in the browser tab, in the header of its
  panel, in a notification, and wherever another message refers to it.
- The forum offers reactions, forward, edit, pin, and search. A teacher can hide
  a message, and hiding is an audited change (ADR 0016). A moderation flag on a
  message is shown to teachers only, and no message is deleted automatically.
  The AI Act class of such a flag is not decided, and counsel assesses it.
- A forward is a reference to the original message and not a copy. It is a stored
  object reference (ADR 0016), so opening it checks permission through the kind
  of the message every time.

### The forum is built on the primitives of Nina

The forum composes the primitives that Nina's transcript composes. The parts that
the design system lacks come from the official shadcn registry, in the style of
the design system, `base-vega` (`packages/design-system/components.json`). No
bespoke part is written.

| Part | State | Use in the class |
| --- | --- | --- |
| `Message`, `MessageContent`, `MessageFooter` | Live | A message and its footer |
| `Bubble`, `BubbleContent` | Live | The body of a message |
| `Attachment` and its parts | Live | The attachments of a message and of the library |
| `MessageScroller` and its parts | Live | The scroll of a channel and of a thread |
| `Marker` | Planned, from the registry | Date separators and the divider before the first unread message |
| `Item` | Planned, from the registry | The rows of the people, library, and task lists |
| `MessageAvatar`, `MessageHeader`, `MessageGroup`, `BubbleGroup`, and `BubbleReactions` | Planned, from the registry | The author line, grouping, and reactions |

`marker`, `item`, `message`, and `bubble` of the `base-vega` registry hold these
parts (the registry files at `ui.shadcn.com/r/styles/base-vega`, read on 13
October 2026). `item` also needs `separator`, which the design system has.
Wave B adds the parts. `Attachment` came from the same registry already, and
`attachment.tsx` names its source. The mention popup is not a registry part (see
Mentions).

### Messages

- The class tables own messages and discussions: `classroomMessages` and
  `classroomThreads` (planned). Nina has no message store of her own in the
  forum. The Agent component keeps only the rows of her turns (ADR 0001).
- The text of a message, the title of a discussion, and the names of attachments
  are sealed with the school key (ADR 0030). Class posts, the text of tasks, and
  submissions are sealed with it too. Counts, states, times, and IDs stay in
  clear.
- A message is kept while its class exists (K10 default), and the organisation
  sets the period. A message or a class can be deleted.
- A post is not journaled for each message (ADR 0016). The journal records
  published changes (`announcement.posted`, `assignment.published`,
  `assignment.deadlineChanged`, and `assignment.missed`, which ADR 0027 lists)
  and audited actions such as hiding a message.
- Sending is optimistic. The message shows at once. If the write fails, the text
  returns to the composer with one Retry button. A send carries a client key, and
  a repeat of the same key writes no second message.
- Search uses the blind index of the school key (ADR 0030). Attachments go
  through the Files module (ADR 0028). The read state of a member, which message
  they have read in a channel or a discussion, belongs to this module
  (`classroomReads`, planned).
- An announcement is a class post. The post owns its content, Home shows a
  projection of it, and the inbox row reads its title from the post (ADR 0027).
- Names, mentions, and message text take `dir="auto"` or `bdi`, while formulas,
  code, URLs, and numbers stay left to right. Dates and times use the school's
  time zone and the local format (ADR 0032). A name or an address without spaces
  may break anywhere, and a long channel name is cut in its rail. The browser
  tests of a class use worst-case data at 390 and 1440 px, in light and dark.

### Mentions

Mentions work as they do in WhatsApp.

- Typing `@` opens a list at the caret of the people the sender may mention: the
  members who can read the class now. The first School's backend rejected any
  other mention (`validateForumMentions` in
  `packages/backend/confect/classes/forums/mentions.ts`), and the new module
  keeps that rule through `decide` (ADR 0012). `@Nina` is in the list. Only a
  teacher can use `@all`.
- A message takes up to 20 mentions, `@Nina` included. The recipients of `@all`
  are written in batches of 100 and not in one transaction (ADR 0027).
- Each mentioned person gets one inbox row, written in the transaction of the
  message (ADR 0027). A mention of Nina starts her reply and writes no row.

The popup is Base UI's Positioner with a virtual anchor at the caret, and a
listbox. It is not Base UI's Autocomplete. Base UI 1.8.0 accepts a virtual
element: `anchor` of `UseAnchorPositioningSharedParameters` takes `Element`,
`VirtualElement`, a ref, or a function that returns one (the type declarations of
`@base-ui/react` 1.8.0, read on 13 October 2026).

A spike comes first, and nothing is committed before it passes. It passes when
the popup stays on screen at 390 px, it never covers the word being typed, the
field keeps focus while the list is open, and the arrow keys, Enter, and Escape
work. It runs in the two engines that `apps/www/playwright.config.ts` runs,
Chromium and WebKit (WebKit for `visual/cards.browser.ts` alone today). The
caret rectangle comes from the field of the composer. A textarea, such as the one
of Nina's composer (`PromptInputTextarea`, used in
`apps/www/components/ai/input.tsx`), offers no caret rectangle, and a Tiptap
editor offers one through ProseMirror. The spike therefore also decides which
field the forum composer is. Status of the spike: planned, in program wave B.

### Nina in a class

- A reply of Nina is an ordinary forum message. The mutation that settles the
  turn as complete writes that message in its own transaction, with the inbox
  rows of a message (ADR 0027). Today the settlement of every Nina turn is
  `closeTurn` in `packages/backend/confect/nina/settlement.ts`. The turn keeps
  its thread and its usage in the Convex Agent component (ADR 0001), and it
  passes the admission rate limit and the credit hold of ADR 0008, as every Nina
  turn does.
- A reply needs no tool approval, because Nina changes no data in the forum.
- If the turn does not complete, no reply is invented, and the question is
  passed on to the teacher.
- A reply costs 5 credits (`responseCredits` in
  `packages/backend/confect/nina/credits/ledger.ts`, pull request #965). In a
  class the credits come from the organisation's pool of AI credits, with a daily
  limit for each member that the Admin sets (ADR 0012), and never from the
  student's personal credits. The credit ledger records the use of each member
  for the day.
- Every conversation of Nina in a class names her as an AI assistant, and each
  reply carries the same label. Her output is never shown as a grade. The logs
  of a class thread hold usage metadata only, never the words of a student.
- Nina answers from the teacher's library and from Nakafa material, with
  citations, and passes the question to the teacher when she is unsure.
- The Agent thread of a class reads no personal memory and no learner profile
  (ADR 0022), and it is sealed with the school key (ADR 0024). The library index
  covers only files that a teacher published (ADR 0023).

### Class settings

| Setting | Rule |
| --- | --- |
| Name, subject, and period | The period comes from Tenancy (ADR 0011). |
| Cover and accent colour | Look only. |
| Students may open discussions | A school policy is the limit. |
| Students may send attachments | Limits are those of the Files module (ADR 0028). |
| Nina in the class | The school's setting is the limit. |
| Archive | The class stays readable and takes no new message. It is the archived condition of ADR 0012. |

A class can narrow what the school allows and never widen it. The school's values
are its tenant settings (ADR 0011): whether students may open threads, which
here means start a discussion, and whether Nina is on. Their change is
`tenant.policy.set` (ADR 0016). Changing a permission of a class, or Nina in a
class, is an audited change as well.

Every change shows at once. If the write fails, the value returns and a Retry
button shows.

### Tasks

A task has a title that gives its address (`.../tasks/latihan-gerak-lurus`, ADR
0026), a deadline, a rule for late work, points, a grade category, and a target
that can be part of the class. The policy of a task is chosen for each task. The
school sets the starting value and its limit. The text of a submission and the
names of its files are sealed (ADR 0030). The teacher releases the grades of the
tasks they own. Publishing a task, changing its deadline, and a missed deadline
are published changes (ADR 0027).

### MessageScroller

`MessageScroller` of the design system replaces the viewport engine of ADR 0005.
It is the primitive of `@shadcn/react` 0.3.1. Its type declarations offer a
provider with `autoScroll` and `defaultScrollPosition` (`start`, `end`, or
`last-anchor`), `preserveScrollOnPrepend` on the viewport, an anchor on an item,
a function that scrolls to a message, and a hook that reports the visible
messages (`message-scroller/index.d.ts` in the package, read on 13 October
2026). They hold no function that loads older messages, so the classroom module
pages the history. The content element is a `log` region with `aria-relevant`
set to `additions` unless a caller sets another value (`message-scroller/index.js`),
so a screen reader may announce a page of older messages that the viewport
prepends, and the history must not be announced again. The tests below prove
what the primitive does not state. The wrapper in the design system does not
virtualize. Its items use `content-visibility: auto`
(`packages/design-system/components/ui/scroller.tsx`).

The read state stays with the classroom module. The module reads the visible
messages from the primitive and writes `classroomReads`.

The tests are the contract of risk R9 of the School blueprint, the regression of
scroll behavior when the forum moves to this scroller. Each runs on a phone and
on a desktop.

| Behavior | Rule | Test |
| --- | --- | --- |
| Open | At the first unread message, or at the last anchor | Open a channel that has unread messages, then open it again. |
| Follow the newest edge | Only while the reader is at the bottom | A new message arrives while the reader is above. The position stays, and a button to the newest message shows. |
| Older history | It loads upward and the position does not change | Scroll up through fifty older messages. The position is the same. |
| Jump | To a message from a mention, from a search, or from the unread marker | Click a mention. The message is exactly in view. |
| Screen reader | A new message is read, and the history is not read again | Test with NVDA, JAWS, and VoiceOver. |

A behavior of the old engine that this table does not name is not carried over.
The persisted snapshots and the navigation history of ADR 0005 are two of them.

## Consequences

- The first School's forum goes with K11. Its web app and viewport are already
  gone from main (#1051), and its backend and tables go with the contract
  release (ADR 0011).
- One scroller serves Nina and the forum, and one set of primitives serves both.
  A fix to a primitive reaches both chats.
- A message in a class writes its row and one row for each mention, at most 20.
  The reads and writes of each feature are counted in `convex-test` (documents
  and bytes), not measured on production (`docs/convex/cost.md`).
- A reply of Nina rests twice: as a forum message and as the Agent rows of its
  turn. Both are sealed with the school key, and both go with the class.
- The forum search finds whole words cut to six characters (ADR 0030).
- A class can be stricter than its school and never looser.
- Nothing virtualizes, so the DOM holds every page of history that the reader
  has loaded. The module therefore pages the history in bounded pages.

## Rejected Alternatives

- The Effect-owned viewport of ADR 0005. It was 38 files for one chat surface,
  while Nina's chat already uses the primitive of the design system.
- Base UI's Autocomplete for mentions. The School blueprint chose the Positioner
  with a virtual anchor and a listbox instead.
- A message store of Nina's own in the forum. The class tables own every message.
- A journal entry for each message. ADR 0016 keeps the journal to published
  changes.
- A copy for a forward. A reference checks permission every time it is opened.
- Plain message text. It would sit in every export and backup (ADR 0030).

## Implementation Status

| Part | Status |
| --- | --- |
| The first School's forum backend: `schoolClassForums`, `schoolClassForumPosts`, and `confect/classes/forums` | Live on main at `f8a5610808`. The contract release of ADR 0011 deletes it (K11). |
| The first School's forum screens and viewport in `apps/www/components/school` | Deleted from main by #1051 |
| `Message`, `Bubble`, `Attachment`, and `MessageScroller` in `packages/design-system/components/ui` | Live |
| `Marker`, `Item`, `MessageAvatar`, `MessageHeader`, `MessageGroup`, `BubbleGroup`, and `BubbleReactions` | Planned, program wave B, from the registry |
| `confect/classroom` and its tables `classrooms`, `classroomMembers`, `classroomPosts`, `classroomThreads`, `classroomMessages`, `classroomReactions`, `classroomReads`, `classroomFolders`, `classroomTasks`, `classroomSubmissions`, and `classroomChannels` | Planned, program wave B |
| The mention popup | Planned. A spike comes first. |
| The parity tests of the scroller | Planned, program wave B |
| Nina in a class | Planned, program wave B |
