# hazo_llm_api Setup Checklist

This checklist guides you through setting up the hazo_llm_api package for use in your project.

---

## Prerequisites

- [ ] Node.js 18+ installed
- [ ] npm or yarn package manager
- [ ] TypeScript project (recommended)

---

## Installation

### 1. Install the Package

```bash
npm install hazo_llm_api
# or
yarn add hazo_llm_api
```

### 2. Install Peer Dependencies

```bash
npm install react react-dom
# or
yarn add react react-dom
```

---

## Configuration

### 3. Create Configuration File

Create `config/hazo_llm_api_config.ini` in your project:

```ini
[llm]
# Comma-separated list or JSON array of enabled providers
enabled_llms=["gemini"]
# Default provider when not specified in API calls
primary_llm=gemini
# SQLite database path for prompt storage
sqlite_path=prompt_library.sqlite

[llm_gemini]
# Gemini API endpoint
api_url=https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent
# Image generation endpoint (optional)
api_url_image=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent
# Supported capabilities
capabilities=["text_text", "image_text", "text_image", "image_image"]
# Generation config (optional)
image_temperature=0.1

# Add other providers as needed (see "Adding New LLM Providers" section)
```

### 4. Set Up Environment Variables

Create `.env.local` in your project root:

```bash
# Required: API key for each enabled provider
GEMINI_API_KEY=your_gemini_api_key_here

# Add keys for other providers
# QWEN_API_KEY=your_qwen_api_key_here
# OPENAI_API_KEY=your_openai_api_key_here
```

**Important:** Add `.env.local` to your `.gitignore` file.

### 5. Configure Next.js (if applicable)

Add to `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['hazo_llm_api'],
};

module.exports = nextConfig;
```

---

## Verification

### 6. Test the Installation

Create a test file to verify the setup:

```typescript
// test-setup.ts (run with ts-node or in your app)
import { initialize_llm_api } from 'hazo_llm_api/server';

const logger = {
  error: console.error,
  info: console.log,
  warn: console.warn,
  debug: console.debug,
};

async function test() {
  try {
    const client = await initialize_llm_api({ logger });
    console.log('✅ LLM API initialized successfully');
    console.log('Database ready:', client.db_initialized);

    // Test a simple call
    const response = await client.hazo_llm_text_text({
      prompt: 'Say hello in one word',
    });

    if (response.success) {
      console.log('✅ API call successful:', response.text);
    } else {
      console.log('❌ API call failed:', response.error);
    }
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

test();
```

---

## Quick Start Usage

### Server-Side (API Routes, Server Components)

```typescript
import {
  initialize_llm_api,
  hazo_llm_text_text,
  hazo_llm_image_text,
} from 'hazo_llm_api/server';

// Initialize once at app startup
await initialize_llm_api({ logger: yourLogger });

// Use the API
const response = await hazo_llm_text_text({
  prompt: 'Your prompt here',
  prompt_variables: { name: 'World' },
});
```

### Client-Side (React Components)

```typescript
import { Layout } from 'hazo_llm_api';

// Use exported React components
function MyPage() {
  return (
    <Layout>
      <YourContent />
    </Layout>
  );
}
```

---

## Database Setup

### Auto-Initialization

The database is **automatically initialized** when you import the package. No manual setup is required for basic usage.

```typescript
// Database initializes automatically on import
import { hazo_llm_text_text } from 'hazo_llm_api/server';

// The prompt_library.sqlite file is created automatically in your project root
```

### SQLite Database

**File**: `prompt_library.sqlite` (created in project root)

**Schema**: The `prompts_library` table is created automatically:

```sql
CREATE TABLE prompts_library (
  uuid TEXT PRIMARY KEY,
  prompt_area TEXT NOT NULL,
  prompt_key TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  prompt_variables TEXT DEFAULT '[]',
  prompt_notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  changed_by TEXT DEFAULT NULL
);

CREATE INDEX idx_prompts_area_key
  ON prompts_library(prompt_area, prompt_key);
```

### Manual Database Operations

You can manually manage the database if needed:

```typescript
import {
  initialize_database,
  insert_prompt,
  update_prompt,
  delete_prompt,
  get_prompt_by_area_and_key,
} from 'hazo_llm_api/server';

// Manual initialization (if needed)
await initialize_database('custom_path.sqlite', logger);

// Insert a prompt
await insert_prompt({
  prompt_area: 'marketing',
  prompt_key: 'greeting',
  prompt_text: 'Hello $name, welcome to our service!',
  prompt_variables: JSON.stringify(['name']),
  prompt_notes: 'Standard greeting message',
}, logger);

// Update a prompt
await update_prompt(
  'marketing',
  'greeting',
  {
    prompt_text: 'Hi $name, welcome back!',
    prompt_notes: 'Updated greeting',
  },
  logger
);

// Delete a prompt
await delete_prompt('marketing', 'greeting', logger);
```

### PostgreSQL Support

PostgreSQL is not currently supported. The package uses sql.js (SQLite) for:
- Zero external dependencies
- Easy deployment
- No server setup required
- File-based storage

If you need PostgreSQL support, please open a feature request on GitHub.

## Troubleshooting Checklist

- [ ] Config file is named exactly `hazo_llm_api_config.ini`
- [ ] Config file is in `config/` directory (or parent directories)
- [ ] Environment variables are in `.env.local` (not `.env`)
- [ ] API key environment variable matches provider name (e.g., `GEMINI_API_KEY`)
- [ ] Provider is listed in `enabled_llms` array
- [ ] `primary_llm` is set to a valid, enabled provider
- [ ] Next.js has `transpilePackages: ['hazo_llm_api']` configured
- [ ] Database file has write permissions
- [ ] SQLite path in config points to a writable location

---

## Adding New LLM Providers

To add a new provider (e.g., OpenAI):

### 1. Add to Config File

```ini
[llm]
enabled_llms=["gemini", "openai"]
primary_llm=gemini

[llm_openai]
api_url=https://api.openai.com/v1/chat/completions
model_text_text=gpt-4
model_image_text=gpt-4-vision-preview
capabilities=["text_text", "image_text"]
```

### 2. Add API Key

```bash
# In .env.local
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Implement Provider (if custom)

If the provider is not built-in, see `techdoc.md` for the provider implementation guide.

---

## File Structure After Setup

```
your-project/
├── .env.local                    # API keys (gitignored)
├── config/
│   └── hazo_llm_api_config.ini   # Package configuration
├── prompt_library.sqlite         # Auto-created prompt database
├── next.config.js                # Next.js config (if applicable)
├── package.json
└── src/
    └── ...your code...
```

---

## Using Bulk Operations (Test App)

The test application provides bulk operations for managing prompts efficiently.

### Bulk Export

1. Navigate to `/prompt-config` page
2. Select prompts using checkboxes (individual or select all)
3. Click "Export" button (Download icon)
4. JSON file downloads with format: `prompts_export_YYYY-MM-DD.json`

**Export Format:**
```json
{
  "version": "1.0",
  "exported_at": "2024-01-15T10:30:00.000Z",
  "prompts": [
    {
      "prompt_area": "marketing",
      "prompt_key": "greeting",
      "prompt_text": "Hello {{name}}",
      "prompt_variables": [
        { "name": "name", "description": "Customer name" }
      ],
      "prompt_notes": "Standard greeting"
    }
  ]
}
```

### Bulk Import

1. Navigate to `/prompt-config` page
2. Click "Import" button (Upload icon)
3. Select a JSON file matching the export format
4. Prompts are validated and imported automatically
5. View success message with import count or error details

**Import Validation:**
- Required fields: `prompt_area`, `prompt_key`, `prompt_text`
- Optional fields: `local_1`, `local_2`, `local_3`, `user_id`, `scope_id`, `prompt_variables`, `prompt_notes`
- Invalid prompts are skipped with error messages

### Bulk Delete

1. Navigate to `/prompt-config` page
2. Select prompts using checkboxes
3. Click "Delete Selected" button
4. Confirm deletion in dialog
5. Selected prompts are permanently removed

**Note:** Bulk delete cannot be undone. Always export prompts before bulk deletion for backup.

---

## Next Steps

- [ ] Review `techdoc.md` for full API documentation
- [ ] Set up prompt templates in the database
- [ ] Configure generation parameters for your use case
- [ ] Implement error handling and logging
- [ ] Test bulk import/export for backup and migration workflows

---

## Support

- Issues: https://github.com/pub12/hazo_llm_api/issues
- Documentation: See `techdoc.md` in this package
