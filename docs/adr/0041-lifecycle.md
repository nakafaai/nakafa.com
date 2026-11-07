# ADR 0041: What A School Can Delete, And What It Archives

## Status

Accepted on 7 November 2026.

## Context

The owner wants every record a school creates to be editable, archivable with restore, and deletable, each with a confirmation, an optimistic change and its rollback. On 7 November most school records could only be archived. Deleting a record that other records point at would leave those records without their parent: a report card without its cohort, or a class without its period.

## Decision

A record that nothing points at is deleted. A record that is in use is refused with a typed error that names what holds it, and archiving stays the way to set it aside with its history. The function that deletes a record also owns the rule that refuses it, and a unit test covers that rule.

| Record | Delete | Refused while | Instead |
| --- | --- | --- | --- |
| Cohort | `tenancy.cohorts.remove`, active or archived | a placed student, an active homeroom teacher, a class, an exam sitting, a report card or a graduation letter points at it (`CohortInUse`) | Archive, then restore |
| Period | `tenancy.periods.remove`, planned or archived | it is active, or a cohort, a class, a class grade, a graduation decision or a promotion points at it (`PeriodInUse`) | Archive, then restore |
| Exam | `exams.exams.remove` | a sitting exists (`ExamInUse`) | Duplicate to change it |
| Grading scheme version | `records.schemes.remove` | a grade was judged with it (`SchemeUsed`) | Add a later version |
| Member | Remove, which ends the member's grants and releases the account but keeps their history | they are the school's last signed-in Owner (`LAST_OWNER`) | |
| Invite | Revoke | | |
| Webhook, API client | Revoke, which stops every delivery or token at once | | |
| Guardian link | Revoke, which ends the link | | |
| Unit | No delete | | Archive, then restore. Every member's unit list, every unit-scoped grant, the unit's billing and its exams point at a unit, and a person's unit list cannot be searched by an index. |

`tenancy/write/holds.ts` owns what keeps a cohort or a period in use. Promotion undo reads the same rule before it deletes the cohorts a promotion created. Each deletion is journalled (`cohort.removed`, `period.removed`), so the audit trail keeps it.

The menu of every row puts Delete last, behind `ConfirmRowMenu`. A row that may not be deleted in its state, such as the active period, keeps the item in view, disabled. A deleted row leaves its list at once, and a refusal puts it back with a toast that says what holds it.

## Consequences

- A school deletes a cohort or a period made by mistake without asking for support.
- No record loses its parent, because every table that points at a cohort or a period is read by an index before the delete.
- A new table that points at a cohort or a period must join `cohortHold` or `periodHold` in the same change, or a delete could leave it without its parent.
