# Contents Module

Track user content views and analytics for year wrap feature.

## Flows

### Anonymous Tracking

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant API as Convex

    U->>C: Visit /math/integration (not logged in)
    C->>C: getOrCreateDeviceId() → "uuid-1234"
    C->>API: trackContentView({ slug, deviceId: "uuid-1234", userId: null })
    API->>API: Insert contentViews with deviceId only
    API-->>C: Saved
```

### Login - Associate Device

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant API as Convex

    U->>C: Click login
    C->>API: Authenticate → userId: "user-abc"
    C->>API: associateDeviceWithUser({ deviceId: "uuid-1234", userId: "user-abc" })
    API->>API: Update contentViews.userId = "user-abc"
    API->>API: Insert userDevices (users module)
    API->>API: Rebuild contentStats
    API-->>C: Associated
```

### Multi-Device Tracking

```mermaid
graph LR
    A[Phone<br/>uuid-abc] --> B[contentViews]
    C[Laptop<br/>uuid-def] --> B
    D[Tablet<br/>uuid-ghi] --> B
    E[User Login] --> F[userDevices<br/>(users module)]
    B --> F
    F --> G[All devices → userId: user-123]
```

### Wrap Feature Query

```mermaid
graph LR
    A["Get User Wrap 2026"] --> B["contentStats O(1) lookup"]
    B --> C[Return totals]

    A --> D["contentViews by userId"]
    D --> E["Filter by year 2026"]
    E --> F["Group by slug"]
    F --> G["Return top content"]
```

### Device ID Cleared (New Anonymous)

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant API as Convex

    U->>C: Clear cookies/localStorage
    C->>C: getOrCreateDeviceId() → "new-uuid"
    C->>API: trackContentView({ slug, deviceId: "new-uuid", userId: null })
    Note over API: Old views lost (expected)
    API-->>C: New anonymous tracking
```

## Edge Cases

| Case | Solution |
| ------ | ---------- |
| Anonymous on multiple devices → Login | Call `associateDeviceWithUser` for each device |
| Shared device (family) | `contentViews.userId` is per-view, not per-device |
| Incognito browsing | `isIncognito` flag marks these views |
| Account deletion (GDPR) | Clear `userId` from views or delete entirely |

## Schema Notes

- `contentViews`: Track every view per device/user
- `contentStats`: Denormalized per-user stats for O(1) wrap access
- `userDevices`: Moved to users module
