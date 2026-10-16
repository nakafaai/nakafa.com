---
"@repo/backend": minor
"@repo/design-system": minor
"@repo/mascot": patch
"www": minor
---

Draw each person's own animal where their initials stood. Every account holds
the animal of its auth id from the day it is made, and an account made before
that holds one from a temporary backfill. The avatar of a person without a photo
shows the animal, and a photo that cannot load shows it at the same size. The
contributor gallery draws its animals the same way, and the initials helper and
the old character component are gone.
