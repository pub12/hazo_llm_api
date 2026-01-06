# hazo_llm_api - Technical Documentation

## Architecture Overview

### Package Structure

The `hazo_llm_api` package is an ES module package providing:
- **Multi-Provider LLM System** with centralized registry and provider abstraction
- **LLM API wrappers** for multiple providers (Gemini, Qwen, extensible to OpenAI, Anthropic, etc.)
- **Prompt management system** with SQLite storage, LRU caching, and variable substitution
- **React components** for UI (Layout)
- **Configuration system** using INI files with environment variable support

```
src/
├── index.ts                    # Client entry point (components + types)
├── server.ts                   # Server entry point (LLM APIs, database)
├── components/
│   └── layout/                 # React UI components
└── lib/
    ├── llm_api/               # Core LLM service functions
    │   ├── index.ts           # Module exports and initialization
    │   ├── provider_helper.ts # Provider lookup/validation helpers
    │   ├── hazo_llm_*.ts      # Service functions (text_text, image_text, etc.)
    │   └── types.ts           # Type definitions
    ├── providers/             # LLM provider implementations
    │   ├── registry.ts        # Provider registration and lookup
    │   ├── types.ts           # Provider interface definitions
    │   ├── gemini/            # Gemini provider
    │   └── qwen/              # Qwen provider
    ├── config/                # Configuration utilities
    │   ├── config_parser.ts   # INI file parsing, generation config
    │   └── provider_loader.ts # Provider factory and loading
    ├── database/              # SQLite database layer
    │   ├── init_database.ts   # Database initialization and CRUD
    │   └── utils.ts           # Shared database utilities
    └── prompts/               # Prompt management
        ├── get_prompt.ts      # Prompt retrieval
        ├── substitute_variables.ts  # Variable substitution
        └── prompt_cache.ts    # LRU prompt caching
```

### Entry Points

The package has two entry points for proper client/server separation:

| Entry Point | Import Path | Purpose |
|-------------|-------------|---------|
| Client | `hazo_llm_api` | React components, types (browser-safe) |
| Server | `hazo_llm_api/server` | LLM APIs, database ops (Node.js only) |

```typescript
// Client-side imports
import { Layout } from 'hazo_llm_api';
import type { LLMResponse } from 'hazo_llm_api';

// Server-side imports
import { initialize_llm_api, hazo_llm_text_text } from 'hazo_llm_api/server';
```

### Module System

The package uses ES modules with explicit file paths (`.js` extensions) in export statements, as required by ES module bundlers:

```typescript
// ✅ CORRECT
export * from './components/index.js';

// ❌ WRONG
export * from './components';
```

### TypeScript Configuration

- **Package**: Uses `tsconfig.json` for development and `tsconfig.build.json` for production builds
- **Module Resolution**: `node16` for package builds (not `bundler`)
- **Module System**: `ESNext` for modern ES module output
- **Type**: Set to `"module"` in package.json

### Build Process

1. TypeScript compilation using `tsc`
2. Source files from `src/` are compiled to `dist/`
3. Declaration files (`.d.ts`) are generated
4. Source maps are included for debugging

## Test Application Architecture

### Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **UI Components**: Shadcn/UI
- **Icons**: Lucide React

### Project Structure

```
test-app/
├── app/                    # Next.js App Router directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/
│   └── sidebar.tsx        # Sidebar navigation component
├── lib/
│   └── utils.ts           # Utility functions
├── next.config.js         # Next.js configuration
├── tsconfig.json          # TypeScript configuration
├── tailwind.config.ts     # TailwindCSS configuration
└── components.json        # Shadcn/UI configuration
```

### Next.js Configuration

The test-app uses:
- React Server Components (RSC) enabled
- Package transpilation for `hazo_llm_api`
- App Router structure

```javascript
transpilePackages: ['hazo_llm_api']
```

This ensures the local package is properly transpiled by Next.js.

### Styling System

TailwindCSS with Shadcn/UI theming:
- CSS variables for theming
- Dark mode support
- Custom color palette
- Responsive design utilities

## Component Details

### Layout Component

**Location**: `src/components/layout/layout.tsx`

**Purpose**: Provides a consistent page structure with optional sidebar and header.

**Structure**:
```tsx
<Layout>
  <Sidebar />
  <Header />
  <MainContent />
</Layout>
```

**Implementation Details**:
- Flexbox-based layout
- Full viewport height
- Sidebar on the left (optional)
- Header at the top (optional)
- Scrollable main content area

**CSS Classes**:
- `cls_layout_container` - Main container
- `cls_layout_sidebar` - Sidebar wrapper
- `cls_layout_main` - Main content wrapper
- `cls_layout_header` - Header wrapper
- `cls_layout_content` - Content area

### Sidebar Component (Test App)

**Location**: `test-app/components/sidebar.tsx`

**Purpose**: Navigation sidebar for the test application.

**Features**:
- Active route highlighting
- Icon support via Lucide React
- Responsive design
- Client-side navigation

## Configuration System

### Configuration File

**File**: `config/hazo_llm_api_config.ini`

**Format**: INI format with sections

**Sections**:
- `[llm]` - Global LLM configuration (enabled_llms, primary_llm, sqlite_path)
- `[llm_gemini]` - Gemini provider configuration
- `[llm_qwen]` - Qwen provider configuration
- `[llm_<provider>]` - Custom provider configurations
- `[logging]` - Log file paths and settings
- `[package]` - Build configuration
- `[test_app]` - Test app settings
- `[ui]` - UI defaults
- `[database]` - Database configuration

### Global LLM Configuration

The `[llm]` section controls which providers are available:

```ini
[llm]
# JSON array or comma-separated list of enabled providers
enabled_llms=["gemini", "qwen"]
# Default provider when not specified in API calls
primary_llm=gemini
# SQLite database path (relative to app root)
sqlite_path=prompt_library.sqlite
```

### Provider Configuration Sections

Each provider has its own `[llm_<name>]` section:

```ini
[llm_gemini]
# API endpoints
api_url=https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent
api_url_image=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent

# Optional per-service model overrides
model_text_text=gemini-2.5-flash
model_image_text=gemini-2.5-flash
model_text_image=gemini-2.5-flash-image
model_image_image=gemini-2.5-flash-image

# Capabilities this provider supports (JSON array)
capabilities=["text_text", "image_text", "text_image", "image_image"]

# Generation parameters (prefixed by service type)
text_temperature=0.7
text_maxOutputTokens=1024
text_topP=0.95
image_temperature=0.1
image_topK=20
```

### Generation Parameter Prefixes

Use `text_` or `image_` prefixes to configure parameters per service type:

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `temperature` | number | Randomness (0.0-2.0) | `text_temperature=0.7` |
| `maxOutputTokens` | number | Max response length | `text_maxOutputTokens=1024` |
| `topP` | number | Nucleus sampling (0.0-1.0) | `text_topP=0.95` |
| `topK` | number | Top-k sampling | `image_topK=20` |
| `stopSequences` | JSON array | Stop sequences | `text_stopSequences=["END"]` |
| `responseMimeType` | string | Response format | `text_responseMimeType=text/plain` |

**Qwen-specific parameters:**
- `max_tokens` instead of `maxOutputTokens`
- `top_p` instead of `topP`
- `top_k` instead of `topK`
- `stop` instead of `stopSequences`
- `presence_penalty`, `frequency_penalty`, `n`

### Environment Variables

**File**: `.env.local` (not committed to git)

**Usage**: Store sensitive API keys

**Format**:
```bash
# Provider API keys (uppercase provider name + _API_KEY)
GEMINI_API_KEY=your_gemini_api_key_here
QWEN_API_KEY=your_qwen_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

**Important**:
- Never commit `.env.local` to git
- Add to `.gitignore`
- API key environment variable naming: `<PROVIDER_NAME>_API_KEY`

## Development Workflow

### Package Development

1. Make changes in `src/` directory
2. Run `npm run build` to compile
3. Test in test-app with `npm run dev:test-app`
4. Package uses local symlink in test-app

### Test App Development

1. Make changes in `test-app/` directory
2. Changes are hot-reloaded by Next.js
3. Access at `http://localhost:3000` (default)

### Building for Production

```bash
# Build package
npm run build

# Build test-app
npm run build:test-app

# Start test-app
npm run start:test-app
```

## Export System

### Package Exports

The package.json defines exports:

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

### Import Patterns

Consumers of the package can import:

```typescript
// Default import
import { Layout } from 'hazo_llm_api';

// Named imports
import { Layout } from 'hazo_llm_api';
```

## File Naming Conventions

- **Components**: `snake_case` (e.g., `layout.tsx`)
- **Directories**: `snake_case`
- **CSS Classes**: Prefixed with `cls_` for easy identification
- **Configuration**: `snake_case` for INI keys

## Code Standards

### Comments

- File-level comments describing purpose
- Function-level comments describing functionality
- Major section comments for code organization

### TypeScript

- Strict mode enabled
- Explicit types preferred
- React 18+ types used

### React

- Functional components only
- Hooks for state management
- Client components marked with `'use client'`

## Dependencies

### Package Dependencies

- **Peer Dependencies**: React 18+, React DOM 18+
- **Dev Dependencies**: TypeScript, type definitions

### Test App Dependencies

- **Runtime**: Next.js, React, React DOM
- **Styling**: TailwindCSS, PostCSS, Autoprefixer
- **UI**: Shadcn/UI components, Lucide icons
- **Utilities**: clsx, tailwind-merge

## Logging

Logging configuration is stored in `config/hazo_llm_api_config.ini`:

```ini
[logging]
logfile=logs/hazo_llm_api.log
```

Logs should be:
- JSON formatted
- Pretty printed
- Include filename, line number, message, and relevant data
- Rotated daily

## LLM Provider System

### Architecture Overview

The provider system uses a **centralized registry** pattern:

```
┌─────────────────────┐
│  Service Functions  │  (hazo_llm_text_text, etc.)
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  Provider Registry  │  (lookup, validation, capability checking)
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│  Provider Instance  │  (GeminiProvider, QwenProvider, etc.)
└─────────────────────┘
```

**Key components:**
1. **Registry** (`lib/providers/registry.ts`): Central provider management
2. **Provider Interface** (`lib/providers/types.ts`): Contract all providers must implement
3. **Provider Implementations** (`lib/providers/gemini/`, `lib/providers/qwen/`): Specific LLM integrations
4. **Configuration Loader** (`lib/llm_api/index.ts`): Reads config and initializes providers

### Provider Interface

All LLM providers implement the `LLMProvider` interface:

```typescript
interface LLMProvider {
  // Identification and capabilities
  get_name(): string;
  get_capabilities(): Set<ServiceType>;
  get_model_for_service(service_type: ServiceType): string | undefined;

  // Service implementations
  text_text(params: TextTextParams, logger: Logger): Promise<LLMResponse>;
  image_text(params: ImageTextParams, logger: Logger): Promise<LLMResponse>;
  text_image(params: TextImageParams, logger: Logger): Promise<LLMResponse>;
  image_image(params: ImageImageParams, logger: Logger): Promise<LLMResponse>;
}
```

### Service Types

| Service | Constant | Description |
|---------|----------|-------------|
| `text_text` | `SERVICE_TYPES.TEXT_TEXT` | Text input → Text output |
| `image_text` | `SERVICE_TYPES.IMAGE_TEXT` | Image input → Text output (analysis) |
| `text_image` | `SERVICE_TYPES.TEXT_IMAGE` | Text input → Image output (generation) |
| `image_image` | `SERVICE_TYPES.IMAGE_IMAGE` | Image input → Image output (transformation) |

### Provider Registry

The registry manages all active providers:

```typescript
// Registration
register_provider(new GeminiProvider(config));
register_provider(new QwenProvider(config));

// Lookup
const provider = get_provider('gemini', logger);

// Capability validation
if (validate_capability(provider, 'text_image', logger)) {
  // Provider supports text → image generation
}

// Check enabled status
if (is_llm_enabled('gemini')) {
  // Provider is enabled in config
}
```

**Registry Functions:**
- `register_provider(provider)` - Add a provider to the registry
- `get_provider(name, logger)` - Get provider by name (returns primary if name is null)
- `set_enabled_llms(names)` - Set which providers are enabled
- `set_primary_llm(name)` - Set the default provider
- `get_primary_llm()` - Get the default provider name
- `validate_capability(provider, service_type, logger)` - Check if provider supports a service
- `clear_registry()` - Clear all providers (for testing)

### Adding a New LLM Provider

To add a new provider (e.g., OpenAI), follow these steps:

#### Step 1: Create Provider Directory

```
src/lib/providers/openai/
├── index.ts           # Exports and provider class
├── openai_provider.ts # Provider implementation
└── openai_client.ts   # API client (optional)
```

#### Step 2: Implement the Provider

```typescript
// src/lib/providers/openai/openai_provider.ts
import type { LLMProvider, ServiceType, LLMCapabilities } from '../types.js';
import type {
  Logger,
  LLMResponse,
  TextTextParams,
  ImageTextParams,
  TextImageParams,
  ImageImageParams,
} from '../../llm_api/types.js';

/**
 * Configuration interface for OpenAI provider
 */
export interface OpenAIProviderConfig {
  api_key: string;
  api_url?: string;
  model_text_text?: string;
  model_image_text?: string;
  model_text_image?: string;
  capabilities?: ServiceType[];
  logger: Logger;
  // Add any provider-specific config here
}

/**
 * OpenAI LLM Provider Implementation
 */
export class OpenAIProvider implements LLMProvider {
  private config: OpenAIProviderConfig;
  private capabilities: LLMCapabilities;

  constructor(config: OpenAIProviderConfig) {
    this.config = config;
    // Default capabilities if not specified
    this.capabilities = new Set(
      config.capabilities || ['text_text', 'image_text']
    );
  }

  get_name(): string {
    return 'openai';
  }

  get_capabilities(): LLMCapabilities {
    return this.capabilities;
  }

  get_model_for_service(service_type: ServiceType): string | undefined {
    const model_map: Record<ServiceType, string | undefined> = {
      text_text: this.config.model_text_text || 'gpt-4',
      image_text: this.config.model_image_text || 'gpt-4-vision-preview',
      text_image: this.config.model_text_image || 'dall-e-3',
      image_image: undefined, // Not supported
    };
    return model_map[service_type];
  }

  async text_text(params: TextTextParams, logger: Logger): Promise<LLMResponse> {
    try {
      const model = this.get_model_for_service('text_text');
      const response = await fetch(
        this.config.api_url || 'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: params.prompt }],
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        logger.error('OpenAI API error', {
          file: 'openai_provider.ts',
          line: 65,
          data: { error: data.error, status: response.status },
        });
        return {
          success: false,
          error: data.error?.message || 'API call failed',
        };
      }

      return {
        success: true,
        text: data.choices?.[0]?.message?.content,
        raw_response: data,
      };
    } catch (error) {
      const error_message = error instanceof Error ? error.message : String(error);
      logger.error('OpenAI text_text failed', {
        file: 'openai_provider.ts',
        line: 78,
        data: { error: error_message },
      });
      return { success: false, error: error_message };
    }
  }

  async image_text(params: ImageTextParams, logger: Logger): Promise<LLMResponse> {
    // Implement GPT-4 Vision API call
    return { success: false, error: 'image_text not yet implemented' };
  }

  async text_image(params: TextImageParams, logger: Logger): Promise<LLMResponse> {
    // Implement DALL-E API call if needed
    return { success: false, error: 'text_image not yet implemented' };
  }

  async image_image(params: ImageImageParams, logger: Logger): Promise<LLMResponse> {
    // OpenAI doesn't support image-to-image transformation
    return { success: false, error: 'image_image not supported by OpenAI provider' };
  }
}
```

#### Step 3: Add Provider Loader to `lib/llm_api/index.ts`

Add a loader function similar to `load_gemini_provider_from_config` and `load_qwen_provider_from_config`:

```typescript
// In lib/llm_api/index.ts, add this function:

function load_openai_provider_from_config(logger: Logger): OpenAIProvider | null {
  const config_path = find_config_file();
  if (!config_path) {
    logger.warn('Config file not found, cannot load OpenAI provider', {
      file: 'index.ts',
      line: 540,
    });
    return null;
  }

  try {
    const config_content = fs.readFileSync(config_path, 'utf-8');
    const config = ini.parse(config_content);
    const openai_section = config.llm_openai || {};

    // Load API key from environment
    const api_key = load_api_key_from_env('openai');
    if (!api_key) {
      logger.error('OPENAI_API_KEY not found in environment variables', {
        file: 'index.ts',
        line: 552,
        data: { config_path },
      });
      return null;
    }

    // Parse capabilities
    const capabilities = parse_capabilities(openai_section.capabilities);

    const provider_config: OpenAIProviderConfig = {
      api_key,
      api_url: openai_section.api_url,
      model_text_text: openai_section.model_text_text,
      model_image_text: openai_section.model_image_text,
      model_text_image: openai_section.model_text_image,
      capabilities: capabilities.length > 0 ? capabilities : undefined,
      logger,
    };

    return new OpenAIProvider(provider_config);
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to load OpenAI provider from config', {
      file: 'index.ts',
      line: 570,
      data: { error: error_message, config_path },
    });
    return null;
  }
}

// Then add to load_and_register_providers function:
function load_and_register_providers(logger: Logger): void {
  // ... existing code ...

  for (const llm_name of global_config.enabled_llms) {
    if (llm_name.toLowerCase() === 'gemini') {
      // ... existing Gemini code ...
    } else if (llm_name.toLowerCase() === 'qwen') {
      // ... existing Qwen code ...
    } else if (llm_name.toLowerCase() === 'openai') {
      const provider = load_openai_provider_from_config(logger);
      if (provider) {
        register_provider(provider);
        logger.info('Registered OpenAI provider', {
          file: 'index.ts',
          line: 595,
          data: {
            capabilities: Array.from(provider.get_capabilities()),
          },
        });
      } else {
        logger.warn('OpenAI provider is enabled in config but failed to load', {
          file: 'index.ts',
          line: 602,
        });
      }
    }
  }
}
```

#### Step 4: Add to Config File

```ini
[llm]
enabled_llms=["gemini", "qwen", "openai"]
primary_llm=gemini

[llm_openai]
api_url=https://api.openai.com/v1/chat/completions
model_text_text=gpt-4
model_image_text=gpt-4-vision-preview
model_text_image=dall-e-3
capabilities=["text_text", "image_text", "text_image"]
text_temperature=0.7
```

#### Step 5: Add API Key to Environment

```bash
# .env.local
OPENAI_API_KEY=your_api_key_here
```

#### Step 6: Export Provider

```typescript
// src/lib/providers/openai/index.ts
export { OpenAIProvider, type OpenAIProviderConfig } from './openai_provider.js';

// src/lib/providers/index.ts
export * from './openai/index.js';
```

### Provider Configuration Parameters

Common configuration parameters supported by the config parser:

| Parameter | Type | Description |
|-----------|------|-------------|
| `temperature` | number | Controls randomness (0.0-2.0) |
| `max_tokens` | number | Maximum response tokens |
| `top_p` | number | Nucleus sampling (0.0-1.0) |
| `top_k` | number | Top-k sampling |
| `stop_sequences` | array | Stop generation sequences |

Use prefixes for service-specific config: `text_temperature`, `image_temperature`

## Prompt Management

### Database Schema

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

### Variable Substitution

Use `$variable_name` syntax in prompts:

```typescript
// Prompt text: "Hello $name, your order #$order_id is ready."
const response = await hazo_llm_text_text({
  prompt_area: 'notifications',
  prompt_key: 'order_ready',
  prompt_variables: {
    name: 'John',
    order_id: '12345',
  },
});
```

### Prompt Caching

The `PromptCache` class implements an LRU (Least Recently Used) cache with TTL support:

**Features:**
- Time-based expiration (TTL)
- LRU eviction when cache is full
- Per-entry access tracking
- Cache statistics (hits, misses, hit rate)
- Configurable size and TTL

**Usage:**

```typescript
import { PromptCache } from 'hazo_llm_api/server';

// Create cache instance
const cache = new PromptCache({
  ttl_ms: 300000,  // 5 minutes
  max_size: 100,   // Maximum entries
  enabled: true,   // Enable/disable caching
});

// Get from cache
const prompt = cache.get('marketing', 'greeting');
if (prompt) {
  // Cache hit - use cached prompt
} else {
  // Cache miss - fetch from database and cache
  const db_prompt = await get_prompt_by_area_and_key(...);
  if (db_prompt) {
    cache.set(db_prompt);
  }
}

// Invalidate specific entry after updates
cache.invalidate('marketing', 'greeting');

// Clear entire cache
cache.clear();

// Get cache statistics
const stats = cache.get_stats();
console.log(`Hit rate: ${stats.hit_rate}%`);
console.log(`Cache size: ${stats.size}/${stats.max_size}`);
```

**Cache Key Format:**
- Format: `{prompt_area}:{prompt_key}`
- Example: `marketing:greeting`, `notifications:order_ready`

**Eviction Policy:**
- **TTL Expiration**: Entries older than `ttl_ms` are removed
- **LRU Eviction**: When cache is full, least recently accessed entry is removed
- **Manual**: Call `invalidate()` or `clear()`

**Default Configuration:**
- TTL: 5 minutes (300,000 ms)
- Max Size: 100 entries
- Enabled: true

## Future Considerations

- Additional LLM providers (Anthropic, Cohere, etc.)
- Streaming response support
- Rate limiting and retry logic
- Response caching
- Testing infrastructure

