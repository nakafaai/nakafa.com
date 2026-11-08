# ADR 0041: What A School Can Delete, And What It Archives

## Status

Accepted on 7 November 2026.

## Context

The owner wants every record a school creates to be editable, archivable with restore, and deletable, each with a confirmation, an optimistic change and its rollback. On 7 November most school records could only be archived. Deleting a record that other records point at would leave those records without their parent: a report card without its cohort, or a class without its period.

## Decision

A record that nothing points at is deleted. A record that is in use is refused with a typed error that names what holds it, and archiving stays the way to set it aside with its history. The function that deletes a record also owns the rule that refuses it, and a unit test covers that rule.

| Record | Delete | Refused while | Instead |
| --- | --- | --- | --- |
| Cohort | `tenancy.cohorts.remove`, active or archived | a placed student, an active homeroom teacher, a class, an exam sitting, a report card, a graduation letter or a promotion points at it (`CohortInUse`) | Archive, then restore |
| Period | `tenancy.periods.remove`, planned or archived | it is active, or a cohort, a class, a class grade, a graduation decision, a promotion or its students' Insight points at it (`PeriodInUse`) | Archive, then restore |
| Exam | `exams.exams.remove` | a sitting exists (`ExamInUse`) | Duplicate to change it |
| Grading scheme version | `records.schemes.remove` | a grade was judged with it (`SchemeUsed`) | Add a later version |
| Member | Remove, which ends the member's grants and releases the account but keeps their history | they are the school's last signed-in Owner (`LAST_OWNER`) | |
| Invite | Revoke | | |
| Webhook, API client | Revoke, which stops every delivery or token at once | | |
| Guardian link | Revoke, which ends the link | | |
| Unit | No delete | | Archive, then restore. Every member's unit list, every unit-scoped grant, the unit's billing and its exams point at a unit, and a person's unit list cannot be searched by an index. |

`tenancy/write/holds.ts` owns what keeps a cohort or a period in use. Each domain that stores a reference to one declares a holder beside its tables (`insight/hold.ts`, `records/hold.ts`, `classroom/classes/hold.ts`, `exams/sittings/hold.ts`, `tenancy/promotion/hold.ts`): the fields it points through, the hold a refusal names, and one indexed read. `holds.ts` registers every holder, and `holds.test.ts` walks the whole schema and fails on any field that points at a cohort or a period and that no holder declares. A period field of a row that belongs to a cohort or a class (a placement, a homeroom row, a report card, a letter, a subject teacher) is covered by that cohort or class, which holds the period while the row holds it, and the registry names the covering field. Two tables keep references to removed subjects by design: the journal, because it records each removal, and the inbox, whose rows read their subject when opened and show nothing of one that is gone (ADR 0027).

A promotion holds the cohorts its plan names and the cohorts it created, in any state, as it holds its two periods. While its undo runs the cohorts step, the cohorts it created are its own work and do not count, so undo reads the same rule before it deletes them. An archived period keeps its students' Insight for 30 days, so a restored period is whole; it may be deleted once the retention job has removed that Insight, and a retention run that finds its period deleted has nothing left to remove. Each deletion is journalled (`cohort.removed`, `period.removed`), so the audit trail keeps it.

An archived cohort, period, or class refuses every write on its own row (ADR 0012), so its delete and its restore are decided at the school level (`tenant.manage`), and the kind's authority loads the row through `lifecycle`, which checks the tenant alone and accepts a locked row. A restore also asks the authority whether the row, made active again, is still locked by its period, cohort, or school (`restorable`), and is refused as `condition` while it is.

The menu of every row puts Delete last, behind `ConfirmRowMenu`. A row that may not be deleted in its state, such as the active period, keeps the item in view, disabled. A deleted row leaves its list at once, and a refusal puts it back with a toast that says what holds it.

## Consequences

- A school deletes a cohort or a period made by mistake without asking for support.
- No record loses its parent, because every table that points at a cohort or a period is read by an index before the delete.
- A new table or field that points at a cohort or a period declares a holder in its domain and registers it in `tenancy/write/holds.ts` in the same change, or `holds.test.ts` fails, so no delete can leave it without its parent.
