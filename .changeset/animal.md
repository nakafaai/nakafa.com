---
"@repo/backend": minor
"@repo/design-system": minor
"@repo/mascot": patch
"www": minor
---

Draw each person's own animal where their initials stood. Every account holds
the animal of its auth id: a new account from the moment it is made, and every
older account since this change shipped, so the field is required. The avatar of
a person without a photo shows the animal, and a photo that cannot load shows it
at the same size. The contributor gallery draws its animals the same way, and
the initials helper and the old character component are gone.
