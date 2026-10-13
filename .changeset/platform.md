---
"www": patch
"@repo/backend": patch
---

Ages and dates are written by the platform: `Intl.RelativeTimeFormat` and
`Intl.DateTimeFormat` with the active locale, and `DateTime` and `Duration` for
the arithmetic. `date-fns` leaves the web app. An age keeps the words that
date-fns wrote in English, Indonesian, and German, the hedges "about", "over",
and "almost" and the phrase for under a minute included, and the lines between
one unit and the next. A test pins them against the words date-fns wrote. An
attempt date keeps its words too: a two-digit hour in the 24-hour languages and
no comma before the time in German. Four things differ. An age counts the time
that passed, so a change of the clocks no longer moves it. A moment after now
reads as under a minute, where a comment or a chat used to read "in 5 minutes"
when the clock of a browser ran behind. The platform spells two short months
otherwise than date-fns did: August in Indonesian ("Agu", not "Agt") and
September in German ("Sept.", not "Sep."). The article card reads the day of
publication in UTC, so a viewer west of UTC no longer sees the day before. A new
device identifier of a content view is a UUID from `randomUuid` instead of a
`nanoid`, and an identifier already stored in a browser stays valid, because
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
that signs with Ed25519 synchronously. Each construction judges every read of
the name it keeps, so an alias or a handover cannot carry a call it forbids.
