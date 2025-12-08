# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run build           # Build the package
npm run dev:package     # Watch mode for package development
npm run dev:test-app    # Run test-app (Next.js dev server)
npm run build:test-app  # Build test-app for production
npm run start:test-app  # Start test-app production server
npm run install:all     # Install all dependencies (workspaces included)
```

## Architecture Overview

ES module npm package providing LLM API wrappers, prompt management, and React components.

### Entry Points

| Import | Purpose |
|--------|---------|
| `hazo_llm_api` | Client-safe: React components, types |
| `hazo_llm_api/server` | Server-only: LLM APIs, database, prompts |

### Package Structure

```
src/
├── index.ts              # Client entry point
├── server.ts             # Server entry point
├── components/           # React components (Layout)
└── lib/
    ├── llm_api/          # Core service functions + provider_helper.ts
    ├── providers/        # Provider implementations (Gemini, Qwen) + registry
    ├── config/           # Config parsing + provider_loader factory
    ├── database/         # SQLite layer + utils.ts
    └── prompts/          # Retrieval, substitution, prompt_cache.ts
```

### Key Utility Files

When modifying service functions or adding providers, use these helpers:

| File | Purpose |
|------|---------|
| `lib/llm_api/provider_helper.ts` | `get_validated_provider()`, logging helpers |
| `lib/llm_api/index.ts` | Config parsing, provider loading, auto-initialization |
| `lib/providers/registry.ts` | Provider registration, lookup, capability validation |
| `lib/database/utils.ts` | `row_to_prompt_record()` (single source of truth) |
| `lib/prompts/prompt_cache.ts` | `PromptCache` class, LRU caching utilities |

### LLM Service Types

- `text_text`, `image_text`, `text_image`, `image_image`
- Chained: `text_image_text`, `image_image_text`

### Configuration

- `hazo_llm_api_config.ini` - LLM provider settings, generation params, database path
  - `[llm]` section: enabled_llms, primary_llm, sqlite_path
  - `[llm_gemini]` section: Gemini provider config
  - `[llm_qwen]` section: Qwen provider config
  - Supports prefixed params: `text_temperature`, `image_temperature`
- `.env.local` - API keys (GEMINI_API_KEY, QWEN_API_KEY, etc.)
  - Format: `<PROVIDER_NAME>_API_KEY` (uppercase)
  - Never commit this file to git

## Code Conventions

- **Naming**: `snake_case` for files, functions, variables, CSS classes
- **CSS Classes**: Prefix with `cls_`
- **ES Module Exports**: Always use `.js` extensions in import/export paths
- **Logging**: Use helpers from `provider_helper.ts` (no hardcoded line numbers)
- **UI**: Shadcn Alert Dialog for acknowledgment, Sonner for notifications

## Adding a New LLM Provider

### Quick Steps

1. **Create provider directory**: `src/lib/providers/{name}/`
   - `{name}_provider.ts` - Implement `LLMProvider` interface
   - `index.ts` - Export provider class and types

2. **Implement LLMProvider interface**:
   ```typescript
   export class MyProvider implements LLMProvider {
     get_name(): string { return 'myprovider'; }
     get_capabilities(): Set<ServiceType> { ... }
     get_model_for_service(service_type: ServiceType): string | undefined { ... }
     async text_text(params, logger): Promise<LLMResponse> { ... }
     async image_text(params, logger): Promise<LLMResponse> { ... }
     async text_image(params, logger): Promise<LLMResponse> { ... }
     async image_image(params, logger): Promise<LLMResponse> { ... }
   }
   ```

3. **Add loader function** to `lib/llm_api/index.ts`:
   - Create `load_{name}_provider_from_config(logger)` function
   - Parse config from `[llm_{name}]` section
   - Load API key from `{NAME}_API_KEY` environment variable
   - Return provider instance or null

4. **Update `load_and_register_providers` function**:
   ```typescript
   } else if (llm_name.toLowerCase() === 'myprovider') {
     const provider = load_myprovider_provider_from_config(logger);
     if (provider) {
       register_provider(provider);
     }
   }
   ```

5. **Add configuration**:
   - Config file: `[llm_myprovider]` section in `hazo_llm_api_config.ini`
   - Environment: `MYPROVIDER_API_KEY` in `.env.local`
   - Enable: Add `"myprovider"` to `enabled_llms` in `[llm]` section

See `techdoc.md` for complete implementation guide with code examples.

## Database

### Overview

- **Engine**: sql.js (SQLite in JavaScript/WebAssembly)
- **File**: `prompt_library.sqlite` (auto-created in project root)
- **Auto-initialization**: Database initializes on module import
- **Schema**: Single `prompts_library` table with index

### Schema

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

CREATE INDEX idx_prompts_area_key ON prompts_library(prompt_area, prompt_key);
```

### Key Functions

- `initialize_database(sqlite_path, logger)` - Manual initialization (optional)
- `get_database()` - Get current database instance
- `close_database()` - Close database connection
- `insert_prompt(prompt_data, logger)` - Insert new prompt
- `update_prompt(area, key, updates, logger)` - Update existing prompt
- `delete_prompt(area, key, logger)` - Delete prompt
- `get_prompt_by_area_and_key(db, area, key, logger)` - Retrieve prompt
- `get_prompts_by_area(db, area, logger)` - Get all prompts in an area
- `get_all_prompts(db, logger)` - Get all prompts

### Utility Helpers

- `row_to_prompt_record()` from `lib/database/utils.ts` - Convert DB row to PromptRecord (single source of truth)

### Caching

Prompts can be cached using `PromptCache` class (LRU with TTL):
- Default TTL: 5 minutes
- Default max size: 100 entries
- Auto-eviction on TTL expiry or when full

## Provider System Architecture

### Registry Pattern

The package uses a **centralized registry** for provider management:

```
Service Function → Registry → Provider Instance → LLM API
```

### Key Components

1. **Provider Interface** (`lib/providers/types.ts`)
   - Defines contract all providers must implement
   - Four required methods: `text_text`, `image_text`, `text_image`, `image_image`
   - Capability declaration and model mapping

2. **Provider Registry** (`lib/providers/registry.ts`)
   - Central store for all registered providers
   - Handles provider lookup by name
   - Validates capabilities before routing requests
   - Tracks enabled/disabled providers

3. **Provider Implementations** (`lib/providers/gemini/`, `lib/providers/qwen/`)
   - Gemini: Full support (all four service types)
   - Qwen: Full support (all four service types)
   - Each provider handles its own API formatting and response parsing

4. **Configuration Loader** (`lib/llm_api/index.ts`)
   - Reads `hazo_llm_api_config.ini`
   - Loads API keys from environment variables
   - Instantiates and registers providers
   - Auto-runs on module import

### Service Flow

1. User calls `hazo_llm_text_text({ prompt: '...' }, 'gemini')`
2. Function checks initialization and gets config
3. Registry looks up 'gemini' provider
4. Registry validates provider supports 'text_text' capability
5. Provider's `text_text()` method is called
6. Provider formats request for Gemini API
7. Provider sends request and parses response
8. Standardized `LLMResponse` returned to user

### Provider Capabilities

Each provider declares which service types it supports:

```typescript
// Gemini supports all four
capabilities: Set(['text_text', 'image_text', 'text_image', 'image_image'])

// A provider that only supports text
capabilities: Set(['text_text'])
```

If a user requests an unsupported capability, the registry returns an error before calling the provider.

### Why This Design?

- **Extensibility**: Add new providers without changing core code
- **Flexibility**: Switch providers per-call or globally
- **Reliability**: Capability validation prevents runtime errors
- **Maintainability**: Each provider is self-contained
- **Testability**: Mock providers easily for testing
