# Logging Utilities

A comprehensive logging solution for the Nakafa project using [Pino](https://getpino.io/) with support for both pretty-printed development logs and raw JSON production logs.

## Features

- 🎨 **Colorful Output**: Beautiful, colorized logs (enabled by default)
- 🔄 **Pretty by Default**: Pretty logs everywhere unless explicitly disabled
- 🏷️ **Service Loggers**: Create dedicated loggers for different services
- 👶 **Child Loggers**: Add contextual information to all logs
- 🛠️ **Utility Functions**: Pre-built functions for common logging patterns
- ⚡ **High Performance**: Built on Pino, one of the fastest Node.js loggers
- 📝 **TypeScript**: Full TypeScript support with comprehensive types

## Installation

The logging utilities are already included in the `@repo/utilities` package with all necessary dependencies:

```json
{
  "dependencies": {
    "pino": "^9.9.0",
    "pino-pretty": "^13.1.1"
  }
}
```

## Quick Start

### Basic Usage

```typescript
import { logger } from '@repo/utilities/logging'

logger.info('Application started')
logger.warn('This is a warning')
logger.error('Something went wrong')
```

### Service-Specific Loggers

```typescript
import { createServiceLogger } from '@repo/utilities/logging'

const apiLogger = createServiceLogger('api')
const dbLogger = createServiceLogger('database')

apiLogger.info('API server listening on port 3000')
dbLogger.info('Connected to PostgreSQL database')
```

### Child Loggers with Context

```typescript
import { createChildLogger } from '@repo/utilities/logging'

const requestLogger = createChildLogger({
  requestId: 'req-123',
  userId: 'user-456'
})

requestLogger.info('Processing user request')
requestLogger.error('Request failed')
```

## Configuration

### Default Configuration

The logger uses pretty-printed, colorized logs by default in development:

- **Development**: Pretty-printed, colorized logs by default (`pretty: true`)
- **Production**: Raw JSON logs for performance and build safety (`pretty: false`)
- **Override**: Explicitly set `pretty: true/false` to override default behavior

### Custom Logger Configuration

```typescript
import { createLogger } from '@repo/utilities/logging'

// Development: pretty logs enabled by default
const devLogger = createLogger({
  level: 'debug',
  service: 'my-service'
})

// Production: raw JSON logs (default behavior)
const prodLogger = createLogger({
  level: 'info',
  service: 'my-service'
})

// Force pretty logs in production (not recommended due to build issues)
const prettyProdLogger = createLogger({
  level: 'info',
  pretty: true,
  service: 'my-service'
})

// Custom: pretty without colors
const customLogger = createLogger({
  level: 'debug',
  pretty: true,
  colorize: false,
  service: 'my-service'
})
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | `'trace' \| 'debug' \| 'info' \| 'warn' \| 'error' \| 'fatal'` | `'info'` | Minimum log level |
| `pretty` | `boolean` | `true` | Enable pretty printing |
| `colorize` | `boolean` | `true` | Enable colors in pretty mode |
| `service` | `string` | `undefined` | Service name for context |

## Log Levels

The logger supports standard log levels with colorized output in pretty mode:

| Level | Description |
|-------|-------------|
| `trace` | Very detailed debugging information |
| `debug` | Debugging information |
| `info` | General information |
| `warn` | Warning messages |
| `error` | Error messages |
| `fatal` | Fatal error messages |

## Utility Functions

The package includes several utility functions for common logging patterns:

### HTTP Request Logging

```typescript
import { logHttpRequest, createServiceLogger } from '@repo/utilities/logging'

const apiLogger = createServiceLogger('api')
logHttpRequest(apiLogger, {
  method: 'GET',
  url: '/api/users', 
  statusCode: 200,
  duration: 45
})
// Output: INFO [api]: GET /api/users - 200 (45ms)
```

### Error Logging

```typescript
import { logError } from '@repo/utilities/logging'

try {
  // Some operation
} catch (error) {
  logError(logger, error as Error, {
    userId: 'user-123',
    action: 'fetch_data'
  })
}
```

### Performance Metrics

```typescript
import { logMetric } from '@repo/utilities/logging'

logMetric(logger, 'response_time', 250, 'ms', { endpoint: '/api/users' })
logMetric(logger, 'memory_usage', 512, 'MB')
```

### Execution Timers

```typescript
import { createTimer } from '@repo/utilities/logging'

const endTimer = createTimer(logger, 'database_query')
// ... perform operation
const duration = endTimer() // Logs execution time
```

### Database Operations

```typescript
import { logDatabaseOperation } from '@repo/utilities/logging'

logDatabaseOperation(logger, 'SELECT', 'users', 45, 150)
// Logs: SELECT users (45ms) - 150 rows
```

### Cache Operations

```typescript
import { logCacheOperation } from '@repo/utilities/logging'

logCacheOperation(logger, 'user:123', true, 3600)
// Logs: Cache HIT: user:123 (TTL: 3600s)
```

## Usage Across Packages

### In Next.js Apps

```typescript
// apps/www/lib/logger.ts
import { createServiceLogger } from '@repo/utilities/logging'
export const wwwLogger = createServiceLogger('www')

// apps/api/lib/logger.ts
import { createServiceLogger } from '@repo/utilities/logging'
export const apiLogger = createServiceLogger('api')
```

### In Shared Packages

```typescript
// packages/connection/lib/logger.ts
import { createServiceLogger } from '@repo/utilities/logging'
export const connectionLogger = createServiceLogger('connection')

// Usage in the package
import { connectionLogger } from './logger'
connectionLogger.info('Making API request')
```

## Examples

See [`examples.ts`](./examples.ts) for comprehensive usage examples covering:

- Basic logging patterns
- Service-specific loggers
- Child loggers with context
- HTTP request logging
- Error handling
- Performance metrics
- Database operations
- Cache operations
- Complex application workflows

## Best Practices

### 1. Use Service-Specific Loggers

Create dedicated loggers for different services or modules:

```typescript
const authLogger = createServiceLogger('auth')
const paymentLogger = createServiceLogger('payment')
```

### 2. Add Context with Child Loggers

Use child loggers to add consistent context:

```typescript
const requestLogger = createChildLogger({ requestId, userId })
```

### 3. Use Appropriate Log Levels

- `trace`: Very detailed debugging (usually disabled in production)
- `debug`: Debugging information (usually disabled in production)
- `info`: General operational messages
- `warn`: Warning conditions that should be noted
- `error`: Error conditions that should be investigated
- `fatal`: Critical errors that may cause application termination

### 4. Leverage Utility Functions

Use the provided utility functions for common patterns instead of manual logging:

```typescript
// Instead of:
logger.info(`GET /api/users - 200 (${duration}ms)`)

// Use:
logHttpRequest(logger, 'GET', '/api/users', 200, duration)
```

### 5. Environment Variables

Control logging behavior with environment variables:

```bash
# Set log level
LOG_LEVEL=debug

# Disable pretty logs via environment (useful for production)
DISABLE_PRETTY_LOGS=true
```

And handle it in code:

```typescript
import { createLogger } from '@repo/utilities/logging'

// Option 1: Use environment variable
const logger = createLogger({
  pretty: process.env.DISABLE_PRETTY_LOGS !== 'true'
})

// Option 2: Environment-aware (like the old behavior)
const envLogger = createLogger({
  pretty: process.env.NODE_ENV === 'development'
})

// Option 3: Production-optimized
const prodLogger = createLogger({
  level: 'warn',
  pretty: false
})
```

## Performance Considerations

- Pino is one of the fastest Node.js loggers
- Raw JSON logs in production are optimized for performance
- Log levels are checked before message formatting
- Child loggers reuse parent logger instances

## Integration with Log Aggregation

In production, the raw JSON logs can be easily integrated with log aggregation services like:

- **Elasticsearch + Kibana**
- **Splunk**
- **DataDog**
- **New Relic**
- **CloudWatch Logs**

The structured JSON format includes:

```json
{
  "level": 30,
  "time": 1699123456789,
  "pid": 12345,
  "hostname": "server-01",
  "name": "api",
  "msg": "Request processed",
  "requestId": "req-123",
  "userId": "user-456"
}
```

## Troubleshooting

### Build Errors with Worker Threads

If you encounter errors like "the worker has exited" or "Cannot find module 'thread-stream/lib/worker.js'", this is because `pino-pretty` uses worker threads which can cause issues during Next.js builds.

**Solution:**

The logger automatically disables pretty formatting in production to prevent these issues. If you need pretty logs in production, consider:

**Option 1: Environment variable approach:**

```bash
NODE_ENV=development pnpm run build  # Force development mode
```

**Option 2: Conditional logger:**

```typescript
const logger = createLogger({
  pretty: process.env.FORCE_PRETTY === 'true'
})
```

**Option 3: Post-build pretty formatting:**

Use a log formatter tool in your deployment pipeline instead of runtime formatting.

### Common Issues

- **Worker thread errors**: Disable pretty logging in production
- **Missing colors**: Ensure your terminal supports ANSI colors
- **Performance concerns**: Use raw JSON logs for high-throughput applications

## Contributing

When adding new utility functions or improving the logger:

1. Add comprehensive TypeScript types
2. Include JSDoc documentation
3. Add usage examples
4. Update this README
5. Ensure backward compatibility
6. Test with both pretty and raw JSON modes
