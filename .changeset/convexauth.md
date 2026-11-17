---
"www": minor
"@repo/backend": minor
---

Sign in with Convex Auth. Sessions, Google sign-in, the school login and the
agent sign-in now run inside the Convex deployment, and every signed-in call
checks its session row, so signing out or revoking a session or an agent ends
reads and writes at once. The refresh token stays in an httpOnly cookie shared
by every school host, a refresh that cannot reach the server keeps the session
instead of signing the learner out, guardians sign in with Google, and an
account is deleted in one step. Each learner signs in once more, and every
account keeps its id.
