# Logging Utilities

A comprehensive logging solution for the Nakafa project using [Pino](https://getpino.io/) with structured JSON logging.

## Features

- 📊 **Structured Logging**: JSON-formatted logs for easy parsing and searching
- 🏷️ **Service Loggers**: Create dedicated loggers for different services
- 👶 **Child Loggers**: Add contextual information to all logs
- 🛠️ **Utility Functions**: Pre-built functions for common logging patterns
- ⚡ **High Performance**: Built on Pino, one of the fastest Node.js loggers
- 📝 **TypeScript**: Full TypeScript support with comprehensive types
- 🔍 **Production Ready**: JSON logs work seamlessly with log aggregation tools (Datadog, CloudWatch, etc.)

## Installation

The logging utilities are already included in the `@repo/utilities` package with all necessary dependencies:

```json
{
  "dependencies": {
    "pino": "^10.1.0"
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

The logger uses JSON-formatted logs in all environments for consistency and ease of parsing:

- **Development**: JSON logs (same as production for consistency)
- **Production**: JSON logs optimized for log aggregation tools
- **Log Level**: `info` by default, configurable via `level` option

### Custom Logger Configuration

```typescript
import { createLogger } from '@repo/utilities/logging'

// Development logger with debug level
const devLogger = createLogger({
  level: 'debug',
  service: 'my-service'
})

// Production logger with info level
const prodLogger = createLogger({
  level: 'info',
  service: 'my-service'
})

// Custom log level
const traceLogger = createLogger({
  level: 'trace'
})
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | `'trace' \| 'debug' \| 'info' \| 'warn' \| 'error' \| 'fatal'` | `'info'` | Minimum log level |
| `service` | `string` | `undefined` | Service name for context |

## Log Levels

The logger supports standard log levels:

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
```

And handle it in code:

```typescript
import { createLogger } from '@repo/utilities/logging'

// Development logger with debug level
const devLogger = createLogger({
  level: process.env.LOG_LEVEL || 'debug'
})

// Production-optimized logger
const prodLogger = createLogger({
  level: 'warn'
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

### Common Issues

- **Log level not filtering**: Ensure the log level is set correctly in your logger configuration
- **Missing logs**: Check that the log level is not too high (e.g., `warn` will not show `info` logs)
- **Performance concerns**: Pino is already optimized, but you can reduce log levels in production for even better performance

## Contributing

When adding new utility functions or improving the logger:

1. Add comprehensive TypeScript types
2. Include JSDoc documentation
3. Add usage examples
4. Update this README
5. Ensure backward compatibility
6. Test with JSON logging in both development and production
