# hazo_llm_api - Technical Documentation

## Architecture Overview

### Package Structure

The `hazo_llm_api` package is an ES module package providing:
- **LLM API wrappers** for multiple providers (Gemini, Qwen, extensible)
- **Prompt management system** with SQLite storage and caching
- **React components** for UI

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

**File**: `hazo_llm_api_config.ini`

**Format**: INI format with sections

**Sections**:
- `[logging]` - Log file paths and settings
- `[package]` - Build configuration
- `[test_app]` - Test app settings
- `[ui]` - UI defaults

### Environment Variables

**File**: `.env.local` (not committed to git)

**Usage**: Store sensitive values like API keys, database credentials, etc.

**Template**: `.env.local.example` provides a template

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

Logging configuration is stored in `hazo_llm_api_config.ini`:

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

### Provider Interface

All LLM providers implement the `LLMProvider` interface:

```typescript
interface LLMProvider {
  get_name(): string;
  get_capabilities(): Set<ServiceType>;
  get_model_for_service(service_type: ServiceType): string | undefined;
  text_text(params: TextTextParams, logger: Logger): Promise<LLMResponse>;
  image_text(params: ImageTextParams, logger: Logger): Promise<LLMResponse>;
  text_image(params: TextImageParams, logger: Logger): Promise<LLMResponse>;
  image_image(params: ImageImageParams, logger: Logger): Promise<LLMResponse>;
}
```

### Service Types

| Service | Description |
|---------|-------------|
| `text_text` | Text input → Text output |
| `image_text` | Image input → Text output (analysis) |
| `text_image` | Text input → Image output (generation) |
| `image_image` | Image input → Image output (transformation) |

### Adding a New LLM Provider

To add a new provider (e.g., OpenAI), follow these steps:

#### Step 1: Create Provider Directory

```
src/lib/providers/openai/
├── index.ts           # Exports
├── openai_provider.ts # Provider implementation
└── openai_client.ts   # API client (optional)
```

#### Step 2: Implement the Provider

```typescript
// src/lib/providers/openai/openai_provider.ts
import type { LLMProvider, ServiceType, LLMCapabilities } from '../types.js';
import type { Logger, LLMResponse, TextTextParams } from '../../llm_api/types.js';

export interface OpenAIProviderConfig {
  api_key: string;
  api_url?: string;
  model_text_text?: string;
  model_image_text?: string;
  capabilities?: ServiceType[];
  logger: Logger;
}

export class OpenAIProvider implements LLMProvider {
  private config: OpenAIProviderConfig;
  private capabilities: LLMCapabilities;

  constructor(config: OpenAIProviderConfig) {
    this.config = config;
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
      text_image: undefined,
      image_image: undefined,
    };
    return model_map[service_type];
  }

  async text_text(params: TextTextParams, logger: Logger): Promise<LLMResponse> {
    // Implement OpenAI API call
    const response = await fetch(this.config.api_url || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.get_model_for_service('text_text'),
        messages: [{ role: 'user', content: params.prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error?.message || 'API call failed' };
    }

    return {
      success: true,
      text: data.choices?.[0]?.message?.content,
    };
  }

  async image_text(params: ImageTextParams, logger: Logger): Promise<LLMResponse> {
    // Implement vision API call
    // ...
  }

  async text_image(params: TextImageParams, logger: Logger): Promise<LLMResponse> {
    return { success: false, error: 'text_image not supported by OpenAI provider' };
  }

  async image_image(params: ImageImageParams, logger: Logger): Promise<LLMResponse> {
    return { success: false, error: 'image_image not supported by OpenAI provider' };
  }
}
```

#### Step 3: Register the Provider Factory

```typescript
// src/lib/providers/openai/index.ts
export { OpenAIProvider, type OpenAIProviderConfig } from './openai_provider.js';

// Register the factory in the config system
import { register_provider_factory, COMMON_PARAM_MAPPINGS } from '../../config/index.js';
import { OpenAIProvider, type OpenAIProviderConfig } from './openai_provider.js';

register_provider_factory({
  name: 'openai',
  config_section: 'llm_openai',
  text_param_mappings: COMMON_PARAM_MAPPINGS,
  image_param_mappings: COMMON_PARAM_MAPPINGS,

  build_config(section, api_key, text_config, image_config, capabilities, logger) {
    return {
      api_key,
      api_url: section.api_url,
      model_text_text: section.model_text_text,
      model_image_text: section.model_image_text,
      capabilities: capabilities.length > 0 ? capabilities : undefined,
      logger,
    };
  },

  create_provider(config) {
    return new OpenAIProvider(config);
  },
});
```

#### Step 4: Add to Config File

```ini
[llm]
enabled_llms=["gemini", "openai"]

[llm_openai]
api_url=https://api.openai.com/v1/chat/completions
model_text_text=gpt-4
model_image_text=gpt-4-vision-preview
capabilities=["text_text", "image_text"]
```

#### Step 5: Add API Key to Environment

```bash
# .env.local
OPENAI_API_KEY=your_api_key_here
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

Prompts are cached in memory to reduce database queries:

```typescript
import { configure_prompt_cache, get_prompt_cache } from 'hazo_llm_api/server';

// Configure cache settings
configure_prompt_cache({
  ttl_ms: 300000,  // 5 minutes
  max_size: 100,   // Maximum entries
  enabled: true,
});

// Invalidate cache after updates
const cache = get_prompt_cache();
cache.invalidate('marketing', 'greeting');
```

## Future Considerations

- Additional LLM providers (Anthropic, Cohere, etc.)
- Streaming response support
- Rate limiting and retry logic
- Response caching
- Testing infrastructure

