---
"@repo/backend": minor
"@repo/internationalization": patch
"www": patch
---

Delete the first School, which nobody used, so the new School starts from
tenancy alone. Its routes, components, classes, forum, materials, and backend
functions are gone, and so are its sign-in redirect, its social image, its
class pictures, and the forum viewport decision record. The owner of a school
is deleted like any other account: the step that handed a school to a successor
and the error that asked for one are gone, and preparing and canceling an
account deletion each finish in one call.

An internal migration, `retire/school:erase`, deletes the old data page by page:
every row of the 16 old tables, the files and scheduled jobs they name, and the
forum posts in the two forum aggregates. It also clears the school fields of
`accountDeletionPreparations`. A later change drops the tables, those fields,
and the migration once every deployment reports nothing left.

The FAQ and the schools section of the home page now say only what is live:
teachers and students use the free lessons and Tryouts, and a school that needs
more can write to us.
