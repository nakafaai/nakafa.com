# Users Module

Manage user accounts and device tracking.

## Flows

### Device Association on Login

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant API as Convex

    U->>C: Click login
    C->>C: Get deviceId from localStorage/cookie
    C->>API: Authenticate → userId: "user-abc"
    C->>API: associateDeviceWithUser({ deviceId, userId, deviceName })
    API->>API: Insert/update userDevices
    API->>API: Update contentViews.userId (contents module)
    API->>API: Rebuild contentStats (contents module)
    API-->>C: Associated
```

### Multi-Device Management

```mermaid
graph LR
    A[User Account] --> B[userDevices]
    C["Phone uuid-abc"] --> B
    D["Laptop uuid-def"] --> B
    E["Tablet uuid-ghi"] --> B
    B --> F["Cross-device continuity"]
```

### Shared Device (Multiple Users)

```mermaid
sequenceDiagram
    participant UA as User A
    participant UB as User B
    participant API as Convex

    UA->>API: associateDevice({ deviceId: "ipad-123", userId: "user-A" })
    API->>API: Create userDevices entry
    UA->>UA: Logout

    UB->>API: associateDevice({ deviceId: "ipad-123", userId: "user-B" })
    API->>API: Create separate userDevices entry (same deviceId)
    Note over API: Two entries, same deviceId, different userId (expected)
```

### Account Deletion (GDPR)

```mermaid
sequenceDiagram
    participant U as User
    participant API as Convex

    U->>API: Request account deletion
    API->>API: Delete all userDevices entries
    API->>API: Clear userId from contentViews (contents module)
    API->>API: Delete user record
    API-->>U: Account deleted
```

## Edge Cases

| Case | Solution |
| ------ | ---------- |
| New user with existing device | Associate existing deviceId with new userId |
| Shared device (family) | Separate `userDevices` entries per user |
| Device inactivity (>30 days) | Mark `isActive: false` via scheduled job |
| Device name collision | Add auto-generated suffix (e.g., "iPhone 2") |

## Schema Notes

- `users`: Synced from Better Auth (email, authId, name, image, role)
- `userDevices`: Track all devices linked to user (deviceId, deviceName, lastSeenAt, isActive)
