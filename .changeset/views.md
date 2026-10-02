---
"www": patch
"@repo/backend": patch
---

Keep no content-view identifier in the browser until the reader allows usage
data. Lessons and articles used to store a random device identifier as soon as
they opened, before any privacy choice. Now the identifier is created only when
a view is recorded after "Allow", and it is removed again when the reader
declines, sends a browser privacy signal, or has not decided yet. Signed-out
views without that choice are not recorded at all, while signed-in views still
update the account's recently viewed content without the identifier. Readers
who allowed usage data keep their identifier, so popular content counts each of
them once per day as before.
