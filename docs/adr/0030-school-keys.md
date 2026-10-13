# ADR 0030: School Text Is Sealed Under A School Key That The Vault Wraps Like A Learner Key

## Status

Accepted on 13 October 2026 with owner decisions K3, K5, and K10. The owner
approved decisions K1 to K20 on that day. The school key is planned for program
wave B (ADR 0013 describes the waves). The learner vault in
`packages/backend/confect/vault` is live and works as it does today. The
repository holds no `tenantKeys` table, no school key, and no connector secret.

## Context

The learner vault seals a text for the learner who owns it. Each learner has one
32-byte key, stored only wrapped by a root key. The root keys come from
`VAULT_ROOT_KEYS` in the Convex environment (`vault/ring.ts`, `vault/keys.ts`).
Chat titles, conversation summaries, and memories are sealed this way today, and
ADR 0024 plans the messages of a chat.

A school holds text that no single learner owns: forum messages, class posts,
task submissions, the Nina threads of a class, the names of uploaded files, and
the secrets of the connections a school makes. The school controls these
records. Deleting an account releases its Persons and leaves the school's
records alone (ADR 0011). A learner's key cannot seal them, because deleting the
learner's account shreds that key (`shredLearnerKeys` in `vault/keys.ts`), and
the school would lose text it keeps.

Sealing is not end-to-end. The server must read a text to grade it, search it,
and answer from it, so it opens a sealed text for a caller that `decide`
allowed (ADR 0012). The seal protects a text at rest: in a table export, in a
backup, and in the dashboard. The threat model below states the limits.

## Decision

### Three key owners

Each key has one owner, and the key above it wraps it.

| Owner | Key | Wrapped by | Table | Status |
| --- | --- | --- | --- | --- |
| Root | `VAULT_ROOT_KEYS` in the Convex environment | Nothing. A rotation rewraps the keys it wrapped. | The environment | Live |
| Learner | 32 random bytes for each learner | A root key | `vaultKeys` | Live |
| School | 32 random bytes for each tenant | A root key | `tenantKeys` | Planned |
| Connection | The secret of a connector | The learner's key for a personal connection, the school's key for a school connection | `connectorSecrets` | Planned |

The vault is one module for all of them. A connection has no vault of its own.
The memories of Nina stay in their own tables (ADR 0022), sealed with the
learner's key.

### The school key

- One key for each tenant. A tenant is an organisation, which the product calls
  a school. The units of a foundation share the key, and ADR 0012 keeps them
  apart.
- It is stored only wrapped by the current root key, in `tenantKeys`, and it is
  created when the tenant is created. The provisioning mutation of ADR 0011
  creates it in the same transaction as the tenant, in the data cell that holds
  the school (ADR 0026, K5). A learner's key is created on first use, because a
  learner exists before anything is sealed for them. A school's key exists from
  the first day, so no read or write has to create it. A tenant without a key is
  a defect, and a reader fails with `VaultError` reason `key`.
- The key never leaves its cell. `VAULT_ROOT_KEYS` is a value of one
  deployment's environment, and Convex refuses a push to a deployment without it
  (`packages/backend/convex/convex.config.ts`). Each cell has its own deployment
  (ADR 0026), so the root keys of a cell wrap only the keys of that cell. A
  school that moves to another cell is opened in the source cell, and the import
  seals its text again under a new key of the target cell. The source key is
  deleted with the source rows.
- A function reads the school's key once and opens everything it returns with
  that one read, as one `vaultKeys` read does in ADR 0024.

### What changes in the vault

Nothing sealed for a learner changes: the same values open with the same keys.
`deriveKeys` takes any 32-byte key, and `seal`, `open`, and `blindHash` take the
keys it derives (`vault/cipher.ts`), so a school key derives the same three keys
as a learner key: an AES-256-GCM key that seals, an HMAC key that makes each
nonce, and an HMAC key that blinds a word.

| Part of `confect/vault` | Today | With the school key |
| --- | --- | --- |
| `cipher.ts` | Seals, opens, and blinds with the keys that any 32-byte key derives | No change |
| `ring.ts` | Reads the root keys from `VAULT_ROOT_KEYS` | No change |
| `keys.ts` | Learner keys: `ensureLearnerKeys`, `readLearnerKeys`, `shredLearnerKeys`, and `rewrapLearnerKeys` | Gains the readers of a school key, its creation (called by provisioning), and its deletion. The wrapped key is bound to the tenant with a label of its own, so a wrapped learner key never opens as a school key. The rewrap (`vault/keys:rewrap`) covers both tables. |
| `text.ts` | `sealText`, `openText`, and `blindText` bind a text to a learner, a table, and a field | They take the keys of an owner, a learner or a tenant, and bind a text to that owner, the table, and the field. A text opens only for that school and that field. |
| `schema.ts` | `VaultKey`, `VaultField`, and `VaultError` | Gains the row of `tenantKeys` (the tenant, the generation, the root key, the wrapped key, and the time of creation) |

### What the school key seals

A free text is sealed. A number or a state that the server computes with is not
(K10).

| Text | Decided in |
| --- | --- |
| Forum messages, discussion titles, and the names of their attachments | ADR 0025 |
| Class posts, and the text of tasks and submissions with the names of their files | ADR 0025 |
| The Nina threads of a class | ADR 0024 |
| The names of uploaded files | ADR 0028 |
| Exam essays, and the names of answer photos | K10, built with the gate and with grading (ADR 0013, ADR 0031) |
| Insight narratives, not their numbers | K10, program wave C |
| The tokens of a school connection, and its Drive copies and Calendar mirrors | ADR 0015 |
| The secret of a webhook, which is sealed and not hashed because the server signs with it | ADR 0029 |

Some values stay unsealed. Grades, attendance, counts, and every other value the
server computes with. The names and states that an index needs, such as class
membership. The report card, whose PDF hash is in the journal. Integrity
signals, which only teachers see. Notifications, which hold an id, a kind, and a
time. The evidence of consent and the journal, which hold IDs and codes without
free text (ADR 0016). Login card codes (ADR 0009) and exam tokens (ADR 0013) are
kept as keyed hashes, and OAuth client secrets as hashes (ADR 0029): they are
checked and never read.

### Forum search and the blind index

The forum is searched through a blind index, as a learner's memory is (ADR 0022).

- A word is blinded with the school's blind key: the first 16 bytes of an
  HMAC-SHA-256 of the word, bound to the table and the field (`blindText` in
  `vault/text.ts`). The version of the index is part of the field name, as
  `words/v2` is for memory (`WORDS_FIELD` in `nina/memory/keys.ts`). The database
  matches the same word again without reading it, and the same word under
  another school's key is another value. The index covers the words of a
  message, of the title of the discussion it starts, and of the names of its
  attachments.
- One function defines a word: `wordsOf` in
  `packages/backend/confect/nina/memory/words.ts`. It applies Unicode NFKC and
  lower case, splits at the word boundaries of `Intl.Segmenter`, and cuts each
  word to its first six characters. The forum uses the same function, so it
  moves into `confect/vault`, next to the blinding, when the forum index is
  built, and memory and the forum import it from there. A change in what a word
  is, is a new version of every index that uses it, each with the re-key job
  that ADR 0022 describes.
- A search reads a bounded number of keys and rows, loads each message through
  its kind, and checks the permission of the caller on every message, so a
  message the caller may not read never appears. The bounds are set when the
  search is built and tested in `convex-test` by the documents it reads
  (`docs/convex/cost.md`).
- The index shows whether two messages of one school share a word and how often
  a blinded word occurs. It shows no word. A search finds a message by whole
  words cut to six characters. It finds no part from the middle of a word, no
  phrase, and no misspelling.

### Connections

A connector secret is sealed under the key of the connection's owner: the
learner's key for a personal connection, the school's key for a school
connection. ADR 0009 says the same for the Google tokens that sign-in stops
storing on the account. `connectorSecrets` holds the sealed secret. No token
sits on an account, and ADR 0015 decides how connectors behave.

| Event | What happens to the connection and its key |
| --- | --- |
| A member leaves the school | The connection is transferred and sealed again under the key of the learner who chooses it, or it is disconnected. |
| The account of the member who made a school connection is deleted | The connection stays and enters the reconnect state. It does not vanish, and it does not work until someone reconnects it. |
| The school is deleted | Every school connection is disconnected before the school key is deleted, and the school is given a deletion record. |

A connection belongs to the Google account of the member who made it, so in the
first row the learner who chooses is that member. In the second row, deleting
the account shreds only the learner key, so the secret under the school key
stays readable. ADR 0015 decides the rest of the connector flow.

The test for the second row: delete the account of the teacher who made the
connection, and the connection must be in the reconnect state, never gone and
never silently working.

### Rotation and replacement

The root key rotates by rewrap. Put the new root key first in `VAULT_ROOT_KEYS`,
run `vault/keys:rewrap` until it returns zero, remove the old root key, and
destroy every copy of it (`vault/keys.spec.ts`). Sealed values do not change,
only the wrapping of the keys. `rewrapLearnerKeys` moves `vaultKeys` alone
today, so this ADR extends it to `tenantKeys` before any school key exists.
Otherwise a retired root key could leave the environment while it still wraps a
school key, and the school's text would be lost. The rewrap reports zero only
when both tables are on the current root key. Its test: with a retired root key,
the rewrap reports a count until it has moved both tables.

The school key itself is replaced only when a leak is suspected. A replacement
is a migration, run the way ADR 0024 runs the migration of old messages.

1. A new row of `tenantKeys` with the next generation is created beside the
   current one. New text is sealed with the newest generation. A reader tries
   the newest and then the previous generation, so text that is not migrated yet
   still opens.
2. A job walks every field sealed under the school key, in bounded batches. It
   seals each value again under the newest generation and rebuilds every blind
   index.
3. A pass that seals nothing again proves that the previous generation can go,
   and its row is deleted.
4. The job is reviewed, runs dry first, and runs on dev and on production until
   a pass reports zero. A test fails when a table seals under the school key and
   is missing from the job.

### Deleting a school

Deleting a school deletes its key, so nothing sealed under it can be opened
again. A backup that still holds the wrapped key opens only while a copy of the
root key that wrapped it exists, the same limit as `shredLearnerKeys`. The
school is given a deletion record. The key is deleted last: first the export,
then the disconnection of the connections, then the rows, because an export
needs the key.

### Effect's EventLogEncryption is not used

`EventLogEncryption` in Effect (`repos/effect/packages/effect/src/eventlog`,
unstable) encrypts the entries of an event log for replication to an identity.
It derives an extractable AES-GCM key from the identity, takes a random 12-byte
IV from `crypto.getRandomValues`, passes no additional authenticated data, and
has no blinding. The vault needs three things it lacks: a nonce derived from the
binding and the bytes, because Convex may run a mutation again with the same
random seed (the comment on `seal` in `vault/cipher.ts`), a binding to the
owner, the table, and the field that GCM authenticates, and a blind hash.
AGENTS.md asks for the Effect module that already does the job, and this module
does another job.

### Threat model

| Actor | Can read | Holds a key | Limit |
| --- | --- | --- | --- |
| Another member of a class | What the class shares | No | Reads no one's private chat or memory |
| A teacher | The data of their classes, through `decide` | No. The server opens it for them. | Reads no private chat or memory |
| A school admin | The data of the school | No. The server opens it for them. | Reads no private chat, because private threads stay out of every role (ADR 0012) |
| A Nakafa operator during a visit | What an Auditor reads, and the journal records it | No | The school approves each visit, which lasts 24 hours at most (ADR 0011, ADR 0012) |
| Whoever holds the environment and the production dashboard | Every text the server can open | `VAULT_ROOT_KEYS` | Access to the environment is access to the text. This is the honest limit. |
| A copy or an export of the database | Nothing that is sealed | No | The rows of a running Nina turn are plain (ADR 0024) |
| An AI provider | The prompt text during a call | No | Zero retention is not proven for Jev (K6, ADR 0019) |
| Whoever holds the link of a shared chat | The shared chat, through its token | No. The server opens it for them. | Revoking the link ends access (ADR 0001) |
| A former member of a school | No school connection after the transfer | Their own key | Their personal connections stay theirs |

## Consequences

- Deleting an account shreds only learner keys. It cannot destroy school text.
- A deleted school cannot be recovered, because its key is the only way to open
  its text.
- One root key opens the keys of learners and of schools. A leaked root key
  opens all of them, and the environment is the limit that the threat model
  names.
- The forum search finds whole words cut to six characters. It finds no phrase
  and no part of a word.
- A school key belongs to the tenant, so the units of a foundation share it.
  `decide` separates them, not the cipher.
- Replacing a school key re-seals the whole school. It is rare and costs one
  pass over every sealed field.
- The comment on `VAULT_ROOT_KEYS` in `packages/backend/convex/convex.config.ts`
  says the keys wrap each learner's vault key. The change that builds the school
  key makes it say learners and schools.

## Rejected Alternatives

- Sealing school text with the key of its author. Deleting the author's account
  would destroy text the school keeps, and a message that a whole class reads has
  no single owner.
- A second vault for connectors. One cipher, one root key ring, and one rotation
  serve every owner.
- End-to-end encryption. The server must read to grade, search, and answer.
- `EventLogEncryption`, for the reasons above.
- Leaving school text plain. It would sit in every export, every backup, and the
  dashboard.

## Implementation Status

| Part | Status |
| --- | --- |
| `packages/backend/confect/vault`: learner keys, seal, open, blind hash, and `rewrap` for `vaultKeys` | Live |
| `VAULT_ROOT_KEYS` in `packages/backend/convex/convex.config.ts` | Live |
| `tenantKeys`, the school key readers, and the owner argument of `vault/text.ts` | Planned, program wave B |
| `rewrap` for `tenantKeys` | Planned, with the school key |
| `wordsOf` moved into `confect/vault`, and the forum index | Planned, with the forum (ADR 0025) |
| The job that replaces a school key | Planned, in the wave of the first table that seals under the school key |
| `connectorSecrets` | Planned (ADR 0015) |
