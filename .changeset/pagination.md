---
"www": patch
---

Keep a lesson's pagination, breadcrumb and outline header working from the
moment they appear. They were rendered only in the browser, so until the page
hydrated readers saw a copy that React replaced on their first press, and a
click on Previous or Next could do nothing. The server now renders them, so
they hydrate in place, the breadcrumb shows the lesson's name without popping
in, and a learning-path link still applies its path once the page loads.
