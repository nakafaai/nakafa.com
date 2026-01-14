# Task Template

## 🎯 Goal

[Clear, actionable goal]

## 📍 Context

[Why this task matters, dependencies]

## PRD

```json
{
  "category": "[functional/architecture/integration/security]",
  "description": "[Specific requirement]",
  "steps": [
    "[Step 1 to verify]",
    "[Step 2 to verify]",
    "[Step 3 to verify]"
  ],
  "passes": false
}
```

## 🎬 Success Criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

## Commands

```bash
# From root directory
pnpm lint
pnpm typecheck
pnpm test
```

## 📝 Subtasks (max 2-3 per task)

### Subtask X.Y.1: [Title]

**File to [create/modify]**: `path/to/file`

**Implementation**:

```typescript
// Implementation code
```

**Output**: [What was accomplished]

---

## 🚀 Next Steps

After this task:
- Next: [Task X.Y]
- Dependencies: [Task A, Task B]

## 🔗 Related Tasks

- Task [X]: [Relationship]
- Task [Y]: [Relationship]

## ⚠️ Important Notes

### Task Prioritization

Choose next task in this order:

1. **Architecture & Core Abstractions** (Foundation first)
2. **Integration Points Between Modules** (Connections second)
3. **Unknown Unknowns & Spike Work** (Risk reduction third)
4. **Standard Features** (Known work fourth)
5. **Polish, Cleanup & Quick Wins** (Last)

**Fail fast** on risky work. Save easy wins for later.

### Progress Tracking

After completing this task, update project progress file:

```txt
[YYYY-MM-DD HH:mm] Task X.Y.Z completed

Key decisions:
- [Decision 1 + reasoning]
- [Decision 2 + reasoning]

Files changed:
- [File path 1]
- [File path 2]

Blockers/notes:
- [Any issues encountered]
- [Notes for next iteration]
```

### DX Guidelines

- Keep changes small and focused
- One logical change per commit
- Prefer multiple small commits over one large commit
- Run feedback loops after each change
- Quality over speed

### Testing

Always run from root directory:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

All commands must pass before marking task complete.
