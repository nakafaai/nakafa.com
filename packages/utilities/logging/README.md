# Effect Logging

Shared logging is Effect-native. Use `Effect.logInfo`, `Effect.logWarning`,
`Effect.logError`, and `Effect.logDebug` directly for ordinary logs.

Use this package only for repeated cross-app patterns:

- `logError` records a stable error shape.
- `logHttpRequest` derives the log level from the HTTP status code.
- `timeOperation` adds a trace span, duration metric, and completion log.

Import helpers directly from the file that owns them:

```ts
import { logError, logHttpRequest, timeOperation } from "@repo/utilities/logging/effect";
```

Keep structured fields as Effect log annotations:

```ts
yield* Effect.logInfo("Weather request started").pipe(
  Effect.annotateLogs({
    service: "weather-api",
    endpoint: "/api/weather",
  })
);
```

Do not add logging barrels, service logger factories, or package-specific logger
instances. Effect already provides the runtime logging, metrics, and tracing
surface; app code should keep the context close to the operation being logged.
