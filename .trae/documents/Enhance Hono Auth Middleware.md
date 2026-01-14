## Plan: Enhance Auth Middleware for Hono + Convex

### Changes to Implement

**1. Add Error Handling (auth.ts)**
- Wrap `verifyApiKey` mutation call in try-catch
- Handle unexpected errors gracefully
- Return consistent error responses

**2. Add Request ID Tracking (auth.ts)**
- Generate or extract request ID from headers
- Store in context for downstream use
- Enable distributed tracing

**3. Add Security Logging (auth.ts)**
- Log authentication failures for auditing
- Include request ID, timestamp, and error reason
- Don't log sensitive data (API keys)

**4. Create Comprehensive Tests**
- Test valid API key authentication
- Test missing/invalid Authorization header
- Test invalid API key
- Test permission checking
- Test error scenarios

### Files to Modify

1. `packages/backend/convex/routes/middleware/auth.ts` - Enhance with error handling, request ID, and logging
2. `packages/backend/convex/routes/__tests__/auth-middleware.test.ts` - Create new test file

### Verification

Run: `pnpm typecheck`, `pnpm lint`, `pnpm test`