# Internal API Key Rotation

## Why Rotate?

- **Security**: Reduce exposure window if key compromised
- **Best practice**: Quarterly rotation recommended
- **Compliance**: Some standards require regular rotation

## Rotation Procedure

### 1. Generate New Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### 2. Update Vercel

1. Go to Vercel dashboard: <https://vercel.com/dashboard>
2. Select `api` project
3. Go to Settings → Environment Variables
4. Find `INTERNAL_CONTENT_API_KEY`
5. Update the value with the new key
6. Save changes

### 3. Update Convex

1. Go to Convex dashboard: <https://dashboard.convex.dev>
2. Select `nakafa` project
3. Go to Settings → Environment Variables
4. Find `INTERNAL_CONTENT_API_KEY`
5. Update the value with the new key
6. Save changes

### 4. Deploy Changes

```bash
pnpm build
```

### 5. Verify Access

- Test internal endpoints still work
- Verify AI tools can fetch content
- Check logs show new key being used

## Notes

- **Zero downtime**: Deploy both systems simultaneously
- **Backward compatible**: Both old and new keys work during deployment
- **Monitor**: Watch for any authentication failures during rotation
- **Testing**: Run verification tests after rotation
