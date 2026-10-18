# ADR 0033: Records Own Grades, Report Cards, And The Dapodik Export

## Status

Accepted on 18 October 2026, by the orchestrator under the owner's standing
instruction to decide, verify, and record. Two points wait for the owner: the
final retention numbers (K10) and counsel's review of the legal basis of report
cards (K20). The Implementation Status table at the end says which parts are
live and which are planned.

Amended on 18 October 2026: the module that releases a grade is Records, so
`grade.released` belongs to it (ADR 0027 and ADR 0031).

## Context

The blueprint's Rapor section makes a report card from subject grades through
one approval flow: the subject teacher fills in, the homeroom teacher completes,
and the principal approves. Nakafa composes, locks, and verifies the report,
and it prepares the SKL and the grade data. It issues no diploma, because the
school issues the diploma itself in the e-Ijazah application.

The repository holds no grading data today. No table stores a grade, an
attendance record, or a report card, and the attempt states stop at `submitted`
(`exams/sittings/schema.ts`). ADR 0013 plans `grading`, `graded`, and `released`.

ADR 0027 already names Records as the publisher of `grade.released`. ADR 0031
gives the release of grades to assessment grading. This ADR settles the owner:
Records publishes `grade.released` for every grade it releases, whatever its
source. The assessment module keeps the teacher's queue and the frozen results
of finished attempts (`assessmentResults`, ADR 0031). It hands each result to
Records as a grade to release.

The Dapodik XLSX export has the same question. ADR 0015, ADR 0029, and the
glossary give it to the Dapodik adapter in `confect/connectors`. The orchestrator
decided on 18 October 2026 that Records owns it, because Records owns the report
data the export writes. The Dapodik import stays with the connectors, because an
import is a source and an export is a product of Records.

## Decision

### Ownership

- `packages/backend/confect/records` owns the grading schemes, the subject grades
  and their release, the attendance and homeroom notes (S3), the report cards,
  the SKL and transcript data, and the Dapodik XLSX export.
- Records publishes `grade.released` (ADR 0027). A grade is released once, and
  the release is journaled in the same transaction (ADR 0016).
- Records reads the roster through the tenancy and classroom authorities: the
  placement of a student in a cohort, the homeroom assignment, the class and its
  subject teachers, and the graduates of a level. It never reads another
  module's tables directly.

### Grading schemes

- A school has dated grading schemes, versioned per school. A scheme holds its
  bands, each with a label and a minimum value, and its KKTP, the minimum
  achievement threshold of each achievement (blueprint, Skema nilai).
- The default school scheme is KKTP 0 to 100 (planned). A changed scheme becomes
  a new version that takes effect from a date.
- Version rule: a grade is judged by the version in force on the date of its
  entry, and it keeps that version. Changing a scheme never rewrites a grade
  that was entered before the change.
- The country profile (ADR 0032, K17) will supply the national schemes and
  their labels. Until it is signed and live, the default is one constant in
  `records/scheme.ts`, and it is the only scheme in code.
- S1 stores and reads the versions and computes the KKTP status of a value. The
  screens that edit a scheme belong to a later slice, so no scheme is written by
  a user yet.

### Subject grades

- A subject grade is one final value for one student, one class, and one
  period. The class is one subject taught to one cohort in one period (GLOSSARY,
  Class). The blueprint's gradebook is a grid of tasks and exams, but no task
  table exists yet (ADR 0025 plans tasks). Until tasks exist, the gradebook holds
  one final value per student, and the grid replaces it when tasks land.
- A grade has two states. `draft` is entered and visible only to the class's
  subject teachers. `released` is visible to the student and to the class's
  subject teachers.
- A subject teacher enters a draft and releases it. A repeated release changes
  nothing and journals nothing. A correction after release is a later slice,
  which writes its own journaled change, so the first release stays on record.
- The `grade.released` change holds the IDs of the class, the student, and the
  period, and the state. It never holds the value, a name, or text (ADR 0016).
  A consumer reads the value from the grade row when it loads the subject, and
  it checks permission then (ADR 0027).

### Access

The `grade` kind covers `classGrades`. Its relations and actions are these:

| Action | Granted by | What it allows |
| --- | --- | --- |
| `grade.enter` | Subject teacher of the class | Writes a draft for a student of the class |
| `grade.release` | Subject teacher of the class | Releases a draft, once, and journals `grade.released` |
| `grade.view` | Subject teacher of the class | Reads every grade of the class, drafts included |
| `grade.view` | Self, on the student's own row | Reads that row once it is released |

The class member relation (ADR 0012, Relations) grants a student the grades of
the class, and in this ADR that means the student's own released grade only. A
student never reads a classmate's grade. The relation is not granted on other
rows of the class.

### Report cards (planned, S4 and S5)

- A report card is prepared for each cohort (rombel) in pages of 100 students,
  with a two-minute lease, and a stopped run resumes, as a promotion does (ADR
  0011).
- The components and their owners follow the blueprint. The subject teacher
  gives the subject grade and the learning description (with a draft from Nina).
  The homeroom teacher gives the attendance, the extracurricular activity, and
  the homeroom note. The principal decides the promotion at year end, with the
  homeroom suggestion (ADR 0012: the Deputy does not approve reports).
- The flow is `draft`, then `completed` by the homeroom teacher, then `approved`
  by the principal, then `locked`. An approved report is locked, and the hash of
  its PDF is journaled.
- The PDF (S5) carries a SHA-256 hash of its exact bytes and a QR code. The QR
  encodes `https://nakafa.com/{locale}/verify/{hash}`, built from `SITE_ORIGIN`
  and the platform `URL` (AGENTS.md). The QR holds only that link, which contains
  the hash and no student data, so it stays within the blueprint's rule that the
  QR holds only the code.
- The PDF states that it is checked by its hash. It is not a certified electronic
  signature, which waits for a PSrE (blueprint, Rapor, legal basis).
- The verification page is public and sits outside school hosts. It answers
  only: whether the hash belongs to a locked report, the school's name, the kind
  of document, the period, and the approval date. It shows no student's name and
  no grade. An unknown hash gets the same "not found" answer whatever it is, and
  the page is rate limited by the existing rate-limit component.
- A school in another data cell needs its verification request to reach that
  cell. The eu cell is planned (K5), so the us cell answers until it is live, and
  the routing rule is recorded before a school signs in the eu cell (What Stays
  Open).

### Graduation and e-Ijazah readiness (planned, S6)

- Graduation follows the last grade of each level: 6 for SD and MI, 9 for SMP and
  MTs, and 12 for SMA, MA, and SMK (ADR 0011).
- The SKL and the transcript data come from the final grades, the e-Ijazah data,
  and the Dapodik export. Nakafa prepares them and does not issue the SKL, which
  the school issues (blueprint, Peran Nakafa).
- The export columns need a pilot school's file. Neither the repository nor the
  blueprint holds a Dapodik template, so S6 does not write the columns before the
  pilot file is read.

### Dapodik XLSX export (planned, S6)

- Records writes the export from the locked reports and the roster. The Dapodik
  adapter in `confect/connectors` keeps the import of the school's upload
  (ADR 0015).
- Dapodik has no official data API until the Ministry signs (K13), so the export
  is a file the school downloads and uploads to Dapodik itself.

### Libraries

The blueprint names no PDF, QR, or XLSX library, and none is on main. The choices
below are the smallest maintained libraries that run in the Convex runtime or in
the browser. "Bare run" means the library bundled for a neutral platform with
esbuild and then ran inside a V8 context with no Node globals (no `Buffer`, no
`process`, no `require`). That approximates the Convex default runtime. The
Convex runtime itself is checked by the first slice that imports each library.

| Need | Candidate | Licence | Last release | Bare run | Measured | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| PDF | jsPDF 4.2.1 | MIT | 17 Mar 2026 | Runs, 243 KB gzip neutral bundle | One A4 page with 40 text lines and a vector QR: median 4 to 30 ms (loaded machine), 39 KB uncompressed (`compress: true` in S5) | Chosen |
| PDF | pdf-lib 1.17.1 | MIT | 6 Nov 2021 | Runs, 176 KB gzip, no fontkit | Median 42 to 48 ms, 4.7 KB output | Not chosen: no release in nearly five years |
| PDF | pdfkit 0.20.2 | MIT | 30 Aug 2026 | Fails with "Invalid URL" when it runs | Median 8 ms, 4.1 KB output | Not chosen: fails the bare run |
| PDF | pdfmake 0.3.12 | MIT | 17 Oct 2026 | Fails bundling for neutral (`events`, `fs`); browser only, 295 KB gzip | Not run in Node | Not chosen: no server path |
| QR | uqr 0.1.3 | MIT | 3 Apr 2026 | Runs, 3.8 KB gzip, no dependencies | 40 of 40 codes decode to their input (jsQR 1.4.0, Apache-2.0); generation about 2 to 5 ms | Chosen |
| QR | qrcode 1.5.4 | MIT | 5 Aug 2024 | Fails bundling for neutral (`util`, `stream`); browser only, 9.4 KB gzip | 40 of 40 decode; generation 1 to 4 ms | Not chosen: no server path |
| XLSX | write-excel-file 4.1.1 and read-excel-file 9.3.12 | MIT | 8 Jun 2026 and 7 Oct 2026 | Runs both ways: a write and a read of a two-row sheet in the bare context | 5,000 rows by six columns: write 142 ms, read 87 ms, 150,884 bytes; 5,001 rows read back | Chosen |
| XLSX | SheetJS xlsx 0.18.5 | Apache-2.0 | 24 Mar 2022 (newest on npm) | Runs, 93 KB gzip | 5,000 rows: write 115 ms, read 80 ms, 1,228,430 bytes | Not chosen: the newest npm release is four years old |
| XLSX | ExcelJS 4.4.0 | MIT | 19 Oct 2023 (a prerelease followed on 20 Dec 2024) | Fails bundling for neutral (`stream`, `util`); browser 264 KB gzip | 5,000 rows: write 146 ms, read 88 ms, 157,909 bytes | Not chosen: no server path |
| Web Push | @block65/webcrypto-web-push 2.0.0 | MIT | 3 Sep 2026 | Neutral bundle has no Node imports, 2.2 KB gzip, one dependency | Node WebCrypto: 4,096-byte encrypted body and a VAPID header with the `k` parameter | Chosen for the push change |
| Web Push | web-push 3.6.7 | MPL-2.0 | 16 Jan 2024 | Fails bundling for neutral and browser (`http`, `https`, `net`) | Not run | Not chosen: Node only, file-level MPL |

Notes on the measurements. Timings come from a loaded laptop, so each figure is a
median of 3 to 15 runs and swings by about two times between runs. The round trips
check output, not speed: every QR decodes to its input, and every XLSX reads back
its rows. The push row proves that encryption and VAPID headers work with Node's
WebCrypto. The bare-context harness could not run the push code, because it passed Node's
WebCrypto into the context, and the library's `instanceof` checks rejected the
ArrayBuffers that came from the other realm. The push change must prove the
encryption inside the Convex runtime, with the RFC 8291 round trip, before it ships.

### Retention

The blueprint's privacy table sets the rules, and K10 owns the final numbers.
Where the blueprint gives no number, the data is kept for the school's contract,
and it is deleted 30 days after the school leaves, after an export.

| Data | Blueprint rule | Rule in this ADR |
| --- | --- | --- |
| Subject grades (`classGrades`) | During the school year, then only inside the report | Kept during the period. When the report is locked, the grade rows are removed with the period, and the locked report keeps the values |
| Report cards and their PDFs | Kept by the legal basis of the country profile; the hash goes to the journal | Kept for the school's contract. Export, then deletion 30 days after the school leaves |
| Grading schemes | Versioned per school | Kept for the school's contract. Versions stay, because grades refer to them |
| Attendance (S3) | During the school year, then only aggregates | Rows removed with the period; aggregates kept in the report |
| Consent evidence (ADR 0034) | Kept under the audit policy; not deleted before the audit period ends | Kept for the school's contract, and not deleted before the audit period ends |
| Dapodik upload | Removed when the import ends | Removed when the import ends (ADR 0028) |
| Dapodik export file | Not stated | Kept only while the school downloads it. Deleted 30 days after the school leaves |
| Journal entries | One period per organisation (ADR 0016) | Unchanged |

### Journal changes

A draft is not journaled per write, as ADR 0016 keeps drafts out of the journal.
Only the release and the lock are journaled.

| Change | Subject | Holds | Published |
| --- | --- | --- | --- |
| `grade.released` | `grade` | IDs and the state `released` | Yes, to the notifications consumer and to webhooks |
| `report.locked` | `report` | IDs and the PDF hash | No, until the exports consumer exists |

## Consequences

- One module owns each fact: grades, their release, and the report that uses
  them. Notifications, webhooks, and exports read the release from the journal.
- A release is written in the same transaction as the grade, so no notice can
  point at a grade that never released.
- A student cannot read a classmate's grade, because the class member relation
  grants only the student's own released row.
- The verification page reveals as little as the QR needs. A check proves that a
  file is the one the school locked, and nothing more.
- The PDF and QR libraries add about 250 KB gzip to the server bundle that builds
  reports. Report generation runs in actions, so the web bundle stays unchanged.

## Rejected Alternatives

- A gradebook grid of tasks and exams in S1. No task table exists yet, so the
  grid would hold tasks that the classroom cannot create.
- Grade values in the journal entries. ADR 0016 keeps entries to IDs and codes.
- Sealing grades. The blueprint leaves them unsealed because the school computes
  them, and a sealed grade could not be aggregated.
- A student name on the verification page. A hash check does not need one, and a
  public page should reveal as little as it can.
- A certified PDF signature now. The PSrE comes later (blueprint).
- SheetJS from npm and ExcelJS. The first has no release since March 2022 on npm,
  and the second does not run where the server runs (see the table).
- web-push. It runs only in Node and carries the MPL-2.0 licence.

## What Stays Open

- The final retention numbers for each data type (K10, owner).
- Counsel's review of the legal basis of report cards and the verification page
  (K20).
- The Dapodik export columns, which need a pilot school's file.
- The routing of a verification request to the cell that issued the report, once
  the eu cell is live (ADR 0026).
- Arabic script in a PDF needs shaping. The measurements did not test shaping or
  the embedding of a Unicode font, so the first school whose report holds Arabic
  text tests both before it ships.
- The push change proves encryption in the Convex runtime with the RFC 8291
  round trip before it ships (see Libraries).

## Implementation Status

| Part | Status |
| --- | --- |
| The decision and the libraries in this ADR | Recorded by S0 |
| `confect/records`, `gradingSchemes`, and `classGrades` (grade entry and release, `grade.released`) | Planned, S1 |
| The gradebook screen for a class | Planned, S2 |
| Attendance and homeroom notes | Planned, S3 |
| Report cards, approval, and lock | Planned, S4 |
| The report PDF with its hash and QR, and the verification page | Planned, S5 |
| SKL, transcript data, and the Dapodik export | Planned, S6 |
| The import of a Dapodik upload in `confect/connectors` | Planned, ADR 0015 |
