# Audio Studies Testing Guide

Test audio generation quality before enabling pre-generation for all content.

## Prerequisites

1. **Convex dev server running** (in another terminal):
   ```bash
   pnpm dev
   # or
   cd packages/backend && pnpm dev
   ```

2. **Content exists in database** (run sync if needed):
   ```bash
   cd packages/backend && pnpm sync
   ```

## Understanding the CLI Timeout Issue

**Important:** When running long actions (script/audio generation takes 10-60 seconds), you may see a **Cloudflare 500 error** in the CLI. This is **NOT** an error with your code - it's a timeout at the Cloudflare edge layer (30-60 second limit).

**What happens:**
- CLI sends request → Cloudflare Edge (30-60s timeout) → Convex (10 min limit)
- If action takes >30s, Cloudflare returns 500 error
- **But the action keeps running on Convex and succeeds!**
- Check Dashboard logs to confirm success

**Solutions:**

### Option A: Use Scheduled Mutations (Recommended for CLI)
Instead of calling actions directly, schedule them to run in the background:

```bash
# Schedule script generation (returns immediately, runs in background)
npx convex run audioStudies/testMutations:scheduleGenerateScript '{"contentAudioId": "AUDIO_ID"}'

# Wait 30 seconds, then check status
npx convex run audioStudies/testQueries:getTestAudioStatus '{"contentAudioId": "AUDIO_ID"}'

# Schedule speech generation
npx convex run audioStudies/testMutations:scheduleGenerateSpeech '{"contentAudioId": "AUDIO_ID"}'
```

### Option B: Use Dashboard (Easiest for testing)
Run actions directly from the Dashboard UI (no timeout issues):
1. Go to [dashboard.convex.dev](https://dashboard.convex.dev)
2. Navigate to Functions
3. Find and run `audioStudies/actions:generateScript`

## Quick Test (Recommended Method)

### Step 1: Find Content to Test

Get a content ID from your database:

```bash
# List recent articles (run from packages/backend directory)
cd packages/backend
npx convex run audioStudies/testQueries:listRecentArticles

# List recent subject sections  
npx convex run audioStudies/testQueries:listRecentSubjectSections
```

Copy the `_id` field from one result (e.g., `"k57b..."`).

### Step 2: Create Test Audio Record

Run this mutation with your content ID:

```bash
npx convex run audioStudies/testMutations:createTestRecord '{"contentId": "YOUR_CONTENT_ID_HERE", "contentType": "article", "locale": "en"}'
```

**Note:** Replace `YOUR_CONTENT_ID_HERE` with the actual ID from Step 1.

The command will return the new audio record ID. **Copy this ID** for Step 3.

### Step 3: Schedule Audio Generation (Fire-and-forget)

Use scheduled mutations to avoid CLI timeout:

```bash
# Schedule script generation (CLI returns immediately)
npx convex run audioStudies/testMutations:scheduleGenerateScript '{"contentAudioId": "YOUR_AUDIO_ID_HERE"}'

# Wait 20-30 seconds for script generation...

# Check if script is ready
npx convex run audioStudies/testQueries:getTestAudioStatus '{"contentAudioId": "YOUR_AUDIO_ID_HERE"}'

# Schedule speech generation
npx convex run audioStudies/testMutations:scheduleGenerateSpeech '{"contentAudioId": "YOUR_AUDIO_ID_HERE"}'

# Wait 30-60 seconds for speech generation...

# Check final status
npx convex run audioStudies/testQueries:getTestAudioStatus '{"contentAudioId": "YOUR_AUDIO_ID_HERE"}'
```

**Note:** Replace `YOUR_AUDIO_ID_HERE` with the ID from Step 2.

**Alternative:** If you get a 500 error, just wait and check status - the action is still running!

### Step 4: View Results

#### See the Generated Script

```bash
npx convex run --no-push 'ctx.db.get("YOUR_AUDIO_ID_HERE").then(r => ({ script: r.script, status: r.status }))'
```

You'll see output like:
```json
{
  "script": "[curious] Have you ever wondered why the sky is blue?\n\n[thoughtful] This is where it gets interesting...",
  "status": "completed"
}
```

**Check for:**
- ✅ Audio tags: `[curious]`, `[excited]`, `[thoughtful]`, `[calm]`
- ✅ Conversational tone (not robotic)
- ✅ Covers key content points
- ✅ Natural flow and pacing

#### Download the Audio

**Option A: Dashboard (Easiest)**
1. Go to [dashboard.convex.dev](https://dashboard.convex.dev)
2. Navigate to your deployment → Storage
3. Find the audio file (check `audioStorageId` field in your record)
4. Click Download

**Option B: CLI**
```bash
# Get the storage ID
npx convex run --no-push 'ctx.db.get("YOUR_AUDIO_ID_HERE").then(r => r.audioStorageId)'

# This returns something like: "k58a..."

# Use Dashboard for easiest download
```

## What to Check

### Script Quality ✅

**Good signs:**
- Uses audio tags naturally (not forced)
- Sounds like a real podcast
- Accurate content summary
- Engaging hook at start
- Clear takeaways at end

**Bad signs:**
- Missing audio tags
- Sounds like reading Wikipedia
- Wrong or missing key points
- Too short or too long

### Audio Quality ✅

**Good signs:**
- Nina's voice sounds warm and natural
- Emotion matches the tags ([excited] sounds excited)
- No awkward pauses
- Clear pronunciation
- Good volume levels

**Bad signs:**
- Robotic or flat voice
- Audio tags not reflected in tone
- Choppy or cut-off words
- Too fast or too slow
- Background noise

## Cost Estimation

Each test costs:
- **Script generation:** ~$0.001 (Gemini Flash)
- **Speech generation:** ~$0.01-0.05 (ElevenLabs V3, depends on length)
- **Total per test:** ~$0.02-0.06

Test 5-10 different content pieces to verify quality before enabling pre-generation.

## Troubleshooting

### "500 Internal Server Error" / Cloudflare Error
**This is expected for long actions!** The CLI request times out at Cloudflare's edge (30-60s), but the action continues running on Convex. 

**Solution:** 
- Use scheduled mutations (`scheduleGenerateScript`, `scheduleGenerateSpeech`)
- Or wait and check status manually
- Or use the Dashboard to run actions

### "Record not found"
Make sure you're using the correct audio ID (from Step 2, not Step 1).

### "No script found"
The generation hasn't completed yet. Wait and check status:
```bash
npx convex run audioStudies/testQueries:getTestAudioStatus '{"contentAudioId": "AUDIO_ID"}'
```

### "Content changed" error
The content was updated during generation. This is the cost protection working! Start over with a fresh content ID.

### Audio sounds bad
- Check if voice settings are appropriate in the record
- Try different content (some topics work better than others)
- Review the script first - if script is bad, audio will be too

## Next Steps

Once you're satisfied with quality:

1. **Enable pre-generation** by adding workflow trigger to content sync
2. **Monitor costs** in ElevenLabs dashboard
3. **Scale gradually** - start with popular content only

## Commands Summary

```bash
# 1. Find content
npx convex run audioStudies/testQueries:listRecentArticles

# 2. Create test record
npx convex run audioStudies/testMutations:createTestRecord '{"contentId": "ID", "contentType": "article", "locale": "en"}'

# 3a. Schedule generation (recommended - avoids timeout)
npx convex run audioStudies/testMutations:scheduleGenerateScript '{"contentAudioId": "AUDIO_ID"}'
npx convex run audioStudies/testMutations:scheduleGenerateSpeech '{"contentAudioId": "AUDIO_ID"}'

# 3b. OR run directly (may get 500 error but still works)
npx convex run audioStudies/actions:generateScript '{"contentAudioId": "AUDIO_ID"}'
npx convex run audioStudies/actions:generateSpeech '{"contentAudioId": "AUDIO_ID"}'

# 4. Check status
npx convex run audioStudies/testQueries:getTestAudioStatus '{"contentAudioId": "AUDIO_ID"}'

# 5. View script
npx convex run --no-push 'ctx.db.get("AUDIO_ID").then(r => r.script)'

# 6. Clean up test record
npx convex run audioStudies/testMutations:deleteTestRecord '{"contentAudioId": "AUDIO_ID"}'
```

Happy testing! 🎧
