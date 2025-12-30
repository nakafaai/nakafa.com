# Bookmarks Module

User content bookmarks with playlist-style organization.

## Flows

### Quick Bookmark (No Collection)

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant API as Convex

    U->>C: Click bookmark icon
    C->>API: getOrCreateDefaultCollection(userId)
    API->>API: Query userId_isDefault → unique()
    Note over API: Create if not exists

    C->>API: createBookmark({ slug, userId, collectionId, order })
    API->>API: Insert bookmarks
    API->>API: Increment bookmarkCollections.bookmarkCount
    API-->>C: Bookmarked
```

### Bookmark to Specific Collection

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant API as Convex

    U->>C: Select collection "Math Favorites"
    C->>API: createBookmark({ slug, userId, collectionId, order })
    API->>API: Insert bookmarks
    API->>API: Increment bookmarkCollections.bookmarkCount
    API-->>C: Bookmarked
```

### Create Collection

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant API as Convex

    U->>C: Click "New Collection"
    C->>API: createCollection({ name, userId, emoji, color })
    API->>API: Insert bookmarkCollections
    API->>API: Set order = next available
    API-->>C: Collection created
```

### Move Bookmark Between Collections

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant API as Convex

    U->>C: Drag bookmark to new collection
    C->>API: updateBookmarkCollection({ bookmarkId, newCollectionId })
    API->>API: Decrement oldCollection.bookmarkCount
    API->>API: Increment newCollection.bookmarkCount
    API->>API: Update bookmark.collectionId
    API-->>C: Moved
```

### Delete Collection (Non-Default)

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant API as Convex

    U->>C: Click delete collection
    C->>API: deleteCollection({ collectionId })
    API->>API: Check isDefault = false
    API->>API: Move bookmarks to default collection
    API->>API: Delete collection
    API-->>C: Deleted
```

### Reorder Bookmarks

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant API as Convex

    U->>C: Drag bookmark to position 3
    C->>API: reorderBookmarks({ userId, collectionId, bookmarkId, newOrder })
    API->>API: Update bookmark.order
    API->>API: Adjust order of other bookmarks
    API-->>C: Reordered
```

### Public Collection Sharing

```mermaid
graph LR
    A["User A"] --> B["Create Collection"]
    B --> C["Set isPublic = true"]
    C --> D["Share URL"]
    D --> E["User B Views"]
    E --> F["Query userId_isPublic"]
    F --> G["Display collection"]
```

## Edge Cases

| Case | Solution |
| ------ | ---------- |
| Duplicate bookmark | Check `userId_slug` index before insert |
| Delete default collection | Prevent via validation (use `userId_isDefault.unique()`) |
| Collection empty | `bookmarkCount = 0`, allow deletion |
| Public collection access | Filter by `userId_isPublic` index |
| Multiple default collections | `userId_isDefault` index with `.unique()` prevents this |

## Schema Notes

- `bookmarks`: User-saved content (slug, userId, collectionId, order, note, bookmarkedAt)
- `bookmarkCollections`: User playlists (name, userId, bookmarkCount, isDefault, isPublic, emoji, color, order)
