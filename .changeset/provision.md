---
"@repo/backend": minor
"@repo/email": minor
---

Let Nakafa open a school. Staff open an organisation with its schools and its
first Owner from the command line with the deployment's key: the tenant, its
schools, the Owner as a Person nobody has claimed yet, the invite for the
Owner's address, and the journal entries for each, in one transaction. A taken
or reserved address, no school, or more than 24 schools is refused with a typed
error and writes nothing.

The Owner gets an invitation email in Indonesian, English, or German and joins
by signing in with the address it names. When Better Auth has verified that
address, the invite is claimed by the account, once, and never from an address
that is not verified. An account that holds the address already joins within
moments of the invite, and an account that signs up or verifies later joins
then. A second account cannot claim the same Person, and one account holds one
Person in a tenant.

Owners and Admins set the country and the contract currency of the
organisation, its policies (whether students may open threads, whether Nina is
on, and which email domains invites accept), and the time zone and content
language of each school, and they archive and restore schools. Each mutation
answers with the value now stored, writes nothing for a value that is already
stored, and is recorded in the journal. A school's Admin changes that school
only, and an archived school refuses changes until an Owner or Admin restores
it. The School viewer returns these settings with the tenant and every school.

The account-ready and invitation emails share one layout, and their legal link
names have one owner.
