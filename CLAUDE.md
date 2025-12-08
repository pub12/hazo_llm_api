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
| `lib/config/config_parser.ts` | `parse_generation_config()`, parameter mappings |
| `lib/config/provider_loader.ts` | `register_provider_factory()`, generic loader |
| `lib/database/utils.ts` | `row_to_prompt_record()` (single source of truth) |
| `lib/prompts/prompt_cache.ts` | `PromptCache` class, caching utilities |

### LLM Service Types

- `text_text`, `image_text`, `text_image`, `image_image`
- Chained: `text_image_text`, `image_image_text`

### Configuration

- `hazo_llm_api_config.ini` - LLM settings, database path
- `.env.local` - API keys (GEMINI_API_KEY, QWEN_API_KEY, etc.)

## Code Conventions

- **Naming**: `snake_case` for files, functions, variables, CSS classes
- **CSS Classes**: Prefix with `cls_`
- **ES Module Exports**: Always use `.js` extensions in import/export paths
- **Logging**: Use helpers from `provider_helper.ts` (no hardcoded line numbers)
- **UI**: Shadcn Alert Dialog for acknowledgment, Sonner for notifications

## Adding a New LLM Provider

1. Create `src/lib/providers/{name}/` with provider class implementing `LLMProvider`
2. Register factory in `config/provider_loader.ts` or provider's index.ts
3. Add `[llm_{name}]` section to config file
4. Add `{NAME}_API_KEY` to `.env.local`
5. Add to `enabled_llms` in `[llm]` section

See `techdoc.md` for full implementation guide.

## Database

SQLite (`prompt_library.sqlite`) with `prompts_library` table. Use `row_to_prompt_record()` from `lib/database/utils.ts` for conversions.
