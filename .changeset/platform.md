---
"www": patch
"@repo/backend": patch
---

Ages and dates are written by the platform: `Intl.RelativeTimeFormat` and
`Intl.DateTimeFormat` with the active locale, and `DateTime` and `Duration` for
the arithmetic. `date-fns` leaves the web app. An age keeps its words in
English, Indonesian, and German but no longer says "about", "over", "almost",
or "less than a minute": an age under half a minute reads "now". The German
attempt date gains a comma before the time. The article card reads the day of
publication in UTC, so a viewer west of UTC no longer sees the day before. A
new device identifier of a content view is a UUID from `randomUuid` instead of
a `nanoid`, and an identifier already stored in a browser stays valid, because
every reader treats it as opaque text. `nanoid` leaves the web app, and the
dependency check rejects both packages coming back.

The acceptance scripts, the customer verification script, and the backend test
fixtures no longer load Node's crypto, buffer, util, os, net, or http modules
where Effect or the platform does the job: Web Crypto makes the RSA and Ed25519
keys, Better Auth's own function signs the learner cookie, `Crypto` hashes the
fixtures, `ConfigProvider.fromDotEnvContents` reads `.env` text,
`NodeSocketServer` probes ports, and `navigator.hardwareConcurrency` counts the
cores. The source check reports those nine modules and keeps three places by
construction: a detached process service, a platform HTTP server, and a fixture
that signs with Ed25519 synchronously.
