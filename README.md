# hazo_llm_api

A wrapper package for calling different LLMs with built-in prompt management and variable substitution.

## Overview

`hazo_llm_api` provides specialized functions for different LLM input/output combinations:

| Function | Input | Output | Use Case |
|----------|-------|--------|----------|
| `hazo_llm_text_text` | Text | Text | Standard text generation, Q&A, summarization |
| `hazo_llm_image_text` | Image | Text | Image analysis, OCR, object detection |
| `hazo_llm_text_image` | Text | Image | Image generation from descriptions |
| `hazo_llm_image_image` | Image(s) | Image | Image editing, combining, transformation |
| `hazo_llm_text_image_text` | Text × 2 | Image + Text | Generate image then analyze it (chained) |
| `hazo_llm_image_image_text` | Images + Prompts | Image + Text | Chain image transformations then describe (chained) |

**Features:**
- **Multi-Provider Support**: Use Gemini, Qwen, or add your own LLM providers
- **Prompt Management**: Store and retrieve prompts from a SQLite database with LRU caching
- **Variable Substitution**: Replace `$variables` in prompts with dynamic values
- **Multi-modal Support**: Handle text and images seamlessly
- **Extensible Architecture**: Provider-based design with simple registration system
- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **Auto-Initialization**: Database initializes automatically on import
- **File-Based Logging**: Built-in Winston logger with daily file rotation

## Installation

```bash
npm install hazo_llm_api
```

## Quick Start

### 1. Set Up Configuration

Create `config/hazo_llm_api_config.ini` in your project:

```ini
[llm]
enabled_llms=["gemini", "qwen"]
primary_llm=gemini
sqlite_path=prompt_library.sqlite

[llm_gemini]
api_url=https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent
api_url_image=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent
capabilities=["text_text", "image_text", "text_image", "image_image"]
image_temperature=0.1
```

Create `.env.local` with your API keys:

```bash
GEMINI_API_KEY=your_api_key_here
QWEN_API_KEY=your_qwen_api_key_here
```

### 2. Initialize the LLM API

```typescript
import {
  initialize_llm_api,
  hazo_llm_text_text,
  hazo_llm_image_text,
  hazo_llm_text_image,
  hazo_llm_image_image,
  // Built-in Winston logger
  create_hazo_logger,
  parse_logging_config,
} from 'hazo_llm_api/server';

// Option A: Use built-in Winston logger with file rotation
const config = parse_logging_config('./config/hazo_llm_api_config.ini');
const logger = create_hazo_logger(config);

// Option B: Use a simple console logger
// const logger = {
//   error: console.error,
//   info: console.log,
//   warn: console.warn,
//   debug: console.debug,
// };

// Initialize - reads config from config/hazo_llm_api_config.ini
await initialize_llm_api({ logger });
```

### 3. Text → Text (Standard Generation)

```typescript
const response = await hazo_llm_text_text({
  prompt: 'Explain quantum computing in simple terms.',
});

if (response.success) {
  console.log(response.text);
}
```

### 4. Image → Text (Image Analysis)

```typescript
const response = await hazo_llm_image_text({
  prompt: 'Describe what you see in this image.',
  image_b64: 'base64_encoded_image_string...',
  image_mime_type: 'image/jpeg',
});

if (response.success) {
  console.log(response.text);
}
```

### 5. Text → Image (Image Generation)

```typescript
const response = await hazo_llm_text_image({
  prompt: 'A serene mountain landscape at sunset',
});

if (response.success && response.image_b64) {
  // Use the generated image
  const image_src = `data:${response.image_mime_type};base64,${response.image_b64}`;
}
```

### 6. Image → Image (Single Image Transformation)

```typescript
const response = await hazo_llm_image_image({
  prompt: 'Convert this image to a watercolor painting style',
  image_b64: 'base64_encoded_image_string...',
  image_mime_type: 'image/jpeg',
});

if (response.success && response.image_b64) {
  // Use the transformed image
}
```

### 7. Multiple Images → Image (Combine Images)

```typescript
const response = await hazo_llm_image_image({
  prompt: 'Combine these two images into one cohesive creative image',
  images: [
    { data: 'base64_image_1...', mime_type: 'image/jpeg' },
    { data: 'base64_image_2...', mime_type: 'image/png' },
  ],
});

if (response.success && response.image_b64) {
  // Use the combined image
}
```

### 8. Text → Image → Text (Chained)

```typescript
const response = await hazo_llm_text_image_text({
  prompt_image: 'A serene Japanese garden with a koi pond',
  prompt_text: 'Describe the mood and elements of this image in detail.',
});

if (response.success) {
  // response.image_b64 - the generated image
  // response.text - the analysis of the generated image
}
```

### 9. Images → Image → Text (Multi-Step Chain)

```typescript
const response = await hazo_llm_image_image_text({
  // Minimum 2 images required
  images: [
    { image_b64: 'base64_image_1...', image_mime_type: 'image/jpeg' },
    { image_b64: 'base64_image_2...', image_mime_type: 'image/png' },
    { image_b64: 'base64_image_3...', image_mime_type: 'image/jpeg' },
  ],
  // Number of prompts = number of images - 1
  prompts: [
    'Combine these two images into a surreal landscape',  // Combines image 1 + 2
    'Add elements from this third image to the result',   // Combines result + image 3
  ],
  description_prompt: 'Describe this final artistic composition in detail.',
});

if (response.success) {
  // response.image_b64 - the final chained image
  // response.text - the description of the result
}
```

**Flow:**
1. Step 1: `images[0]` + `images[1]` + `prompts[0]` → result_1
2. Step 2: result_1 + `images[2]` + `prompts[1]` → result_2
3. ... continue for more images
4. Final: last result + `description_prompt` → text output

## API Reference

### `initialize_llm_api(config: LLMApiConfig): Promise<LLMApiClient>`

Initialize the LLM API. Must be called before using any other functions.

Configuration is read from `config/hazo_llm_api_config.ini` file.

#### LLMApiConfig

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `logger` | Logger | Yes | - | Winston-compatible logger instance |
| `sqlite_path` | string | No | From config file | Path to SQLite database |
| `api_url` | string | No | - | Legacy: API endpoint URL (deprecated, use config file) |
| `api_url_image` | string | No | - | Legacy: Image API endpoint (deprecated, use config file) |
| `api_key` | string | No | - | Legacy: API key (deprecated, use .env.local) |
| `llm_model` | string | No | From config file | Legacy: Provider name (deprecated, use config file) |

**Note:** The config file approach is recommended over passing configuration directly. This keeps sensitive API keys out of your codebase.

---

### `hazo_llm_text_text(params: TextTextParams): Promise<LLMResponse>`

Text input → Text output. Standard text generation.

#### TextTextParams

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | The prompt text |
| `prompt_variables` | PromptVariables | No | Variables to substitute |
| `prompt_area` | string | No | Area for dynamic prompt lookup |
| `prompt_key` | string | No | Key for dynamic prompt lookup |

---

### `hazo_llm_image_text(params: ImageTextParams): Promise<LLMResponse>`

Image input → Text output. Analyze an image and get text description.

#### ImageTextParams

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Instructions for analyzing the image |
| `image_b64` | string | Yes | Base64 encoded image data |
| `image_mime_type` | string | Yes | MIME type (e.g., "image/jpeg") |
| `prompt_variables` | PromptVariables | No | Variables to substitute |

---

### `hazo_llm_text_image(params: TextImageParams): Promise<LLMResponse>`

Text input → Image output. Generate an image from a text description.

#### TextImageParams

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Description of image to generate |
| `prompt_variables` | PromptVariables | No | Variables to substitute |

---

### `hazo_llm_image_image(params: ImageImageParams): Promise<LLMResponse>`

Image(s) input → Image output. Transform, edit, or combine images based on instructions.

Supports both single image and multiple images input.

#### ImageImageParams

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Transformation/combination instructions |
| `image_b64` | string | For single image | Base64 encoded input image |
| `image_mime_type` | string | For single image | MIME type of input image |
| `images` | Base64Data[] | For multiple images | Array of images to combine |
| `prompt_variables` | PromptVariables | No | Variables to substitute |

**Note:** Use either `image_b64`/`image_mime_type` for single image OR `images` array for multiple images.

---

### `hazo_llm_text_image_text(params: TextImageTextParams): Promise<LLMResponse>`

Text → Image → Text (Chained). Generate an image from one prompt, then analyze it with a second prompt.

This function chains two operations:
1. Generate an image using `prompt_image`
2. Analyze the generated image using `prompt_text`

Returns both the generated image and the analysis text.

#### TextImageTextParams

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt_image` | string | Yes | Description of image to generate |
| `prompt_text` | string | Yes | Prompt for analyzing the generated image |
| `prompt_image_variables` | PromptVariables | No | Variables for image generation prompt |
| `prompt_text_variables` | PromptVariables | No | Variables for analysis prompt |

---

### `hazo_llm_image_image_text(params: ImageImageTextParams): Promise<LLMResponse>`

Images → Image → Text (Multi-Step Chained). Chain multiple image transformations, then describe the result.

**Flow:**
1. Combine `images[0]` + `images[1]` using `prompts[0]` → result_1
2. Combine result_1 + `images[2]` using `prompts[1]` → result_2
3. Continue for all images
4. Describe final result using `description_prompt` → text output

Returns both the final image and the description text.

#### ImageImageTextParams

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `images` | ChainImage[] | Yes | Array of images to chain (minimum 2) |
| `prompts` | string[] | Yes | Transformation prompts (length = images.length - 1) |
| `description_prompt` | string | Yes | Prompt for describing the final image |
| `description_prompt_variables` | PromptVariables | No | Variables for description prompt |

#### ChainImage

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image_b64` | string | Yes | Base64 encoded image data |
| `image_mime_type` | string | Yes | MIME type (e.g., "image/jpeg") |

---

### LLMResponse

All functions return an `LLMResponse`:

```typescript
interface LLMResponse {
  success: boolean;           // Whether the call succeeded
  text?: string;              // Generated text response
  image_b64?: string;         // Generated image (base64)
  image_mime_type?: string;   // MIME type of generated image
  error?: string;             // Error message if failed
  raw_response?: unknown;     // Raw API response
}
```

## Using Specific LLM Providers

By default, all functions use the `primary_llm` configured in your config file. You can override this per-call:

```typescript
// Use Gemini explicitly
const response1 = await hazo_llm_text_text(
  { prompt: 'Hello world' },
  'gemini'
);

// Use Qwen explicitly
const response2 = await hazo_llm_text_text(
  { prompt: 'Hello world' },
  'qwen'
);

// Use primary LLM (from config)
const response3 = await hazo_llm_text_text(
  { prompt: 'Hello world' }
);
```

### Provider Configuration

Each provider has its own section in `config/hazo_llm_api_config.ini`:

```ini
[llm_gemini]
api_url=https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent
api_url_image=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent
capabilities=["text_text", "image_text", "text_image", "image_image"]
text_temperature=0.7
image_temperature=0.1

[llm_qwen]
api_url=https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions
model_text_text=qwen-max
model_image_text=qwen-vl-max
capabilities=["text_text", "image_text"]
text_temperature=0.8
```

### Supported Providers

| Provider | Capabilities | Configuration Required |
|----------|-------------|------------------------|
| Gemini | text_text, image_text, text_image, image_image | GEMINI_API_KEY in .env.local |
| Qwen | text_text, image_text, text_image, image_image | QWEN_API_KEY in .env.local |
| Custom | Define your own | Implement LLMProvider interface |

See `TECHDOC.md` for instructions on adding custom providers.

## Prompt Management

### Database Schema

Prompts are stored in a SQLite database with the following table:

**Table: `prompts_library`**

| Column | Type | Description |
|--------|------|-------------|
| `uuid` | TEXT | Unique identifier |
| `prompt_area` | TEXT | Category/area for the prompt |
| `prompt_key` | TEXT | Unique key within the area |
| `prompt_text` | TEXT | The prompt template |
| `prompt_variables` | TEXT | JSON array of expected variables |
| `prompt_notes` | TEXT | Documentation/notes |
| `created_at` | TEXT | Creation timestamp |
| `changed_by` | TEXT | Last update timestamp |

### Variable Substitution

Variables in prompt text starting with `$` are automatically replaced:

```
Prompt: "Write about $topic in $style style."
Variables: [{ topic: "AI", style: "academic" }]
Result: "Write about AI in academic style."
```

### Dynamic Prompts

Use `prompt_area` and `prompt_key` to fetch prompts from the database:

```typescript
const response = await hazo_llm_text_text({
  prompt: '', // Will be overridden by dynamic prompt
  prompt_area: 'marketing',
  prompt_key: 'product_description',
  prompt_variables: [{ product_name: 'Widget Pro' }],
});
```

### Prompt Import/Export Format

The test application supports bulk import/export of prompts via JSON files. This enables backup, migration, and sharing of prompt libraries.

#### Export Format

When exporting prompts, the JSON file follows this structure:

```json
{
  "version": "1.0",
  "exported_at": "2024-01-15T10:30:00.000Z",
  "prompts": [
    {
      "prompt_area": "marketing",
      "prompt_key": "greeting",
      "local_1": null,
      "local_2": null,
      "local_3": null,
      "user_id": null,
      "scope_id": null,
      "prompt_text": "Hello {{name}}, welcome to {{service}}.",
      "prompt_variables": [
        { "name": "name", "description": "Customer name" },
        { "name": "service", "description": "Service name" }
      ],
      "prompt_notes": "Standard greeting for marketing emails"
    }
  ]
}
```

#### Required Fields for Import

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt_area` | string | Yes | Category/area for the prompt |
| `prompt_key` | string | Yes | Unique key within the area |
| `prompt_text` | string | Yes | The prompt template text |
| `local_1` | string \| null | No | Local filter 1 (e.g., region) |
| `local_2` | string \| null | No | Local filter 2 (e.g., department) |
| `local_3` | string \| null | No | Local filter 3 (e.g., sub-category) |
| `user_id` | string \| null | No | User-specific identifier |
| `scope_id` | string \| null | No | Scope-specific identifier |
| `prompt_variables` | array | No | Array of `{ name, description }` objects |
| `prompt_notes` | string | No | Documentation/notes for the prompt |

#### Import Behavior

- Each imported prompt receives a new UUID automatically
- `created_at` is set to the import timestamp
- `changed_at` is set to the import timestamp
- Duplicate `prompt_area`/`prompt_key` combinations create new entries (no automatic deduplication)
- Invalid prompts (missing required fields) are skipped with errors reported

#### Bulk Operations UI

The test application's Prompt Configuration page (`/prompt-config`) provides a user interface for bulk operations:

**Selection:**
- Individual row selection via checkbox
- Select all/deselect all checkbox in table header
- Visual indication of selected rows

**Export:**
1. Select one or more prompts using checkboxes
2. Click "Export" button (Download icon)
3. JSON file downloads automatically with filename: `prompts_export_YYYY-MM-DD.json`

**Import:**
1. Click "Import" button (Upload icon)
2. Select a JSON file matching the export format
3. Prompts are validated and imported automatically
4. Success/error messages display import results

**Delete:**
1. Select one or more prompts using checkboxes
2. Click "Delete Selected" button
3. Confirm deletion in dialog
4. Selected prompts are removed permanently

#### API Endpoints

The test application provides bulk operation endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/prompts/bulk` | Import prompts from JSON |
| `DELETE` | `/api/prompts/bulk` | Delete multiple prompts by ID |

**Import Request:**
```json
{
  "prompts": [
    { "prompt_area": "...", "prompt_key": "...", "prompt_text": "..." }
  ]
}
```

**Import Response:**
```json
{
  "success": true,
  "imported_count": 5,
  "errors": ["Optional array of error messages for failed imports"]
}
```

**Delete Request:**
```json
{
  "ids": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Delete Response:**
```json
{
  "success": true,
  "deleted_count": 3,
  "errors": ["Optional array of error messages for failed deletions"]
}
```

## Server-Side Only

**Important**: All LLM API functions must be used server-side only.

```typescript
// ✅ Correct - Server-side import
import { hazo_llm_text_text } from 'hazo_llm_api/server';

// ❌ Wrong - Will fail on client-side
import { hazo_llm_text_text } from 'hazo_llm_api';
```

Use in:
- Next.js API routes
- Next.js Server Components
- Next.js Server Actions
- Node.js backend services

## Examples

### Chat/Q&A

```typescript
const response = await hazo_llm_text_text({
  prompt: `Answer this question: ${user_question}`,
});
```

### Document Summarization

```typescript
const response = await hazo_llm_text_text({
  prompt: `Summarize this document in 3 bullet points:\n\n${document_text}`,
});
```

### Image OCR

```typescript
const response = await hazo_llm_image_text({
  prompt: 'Extract all text from this image.',
  image_b64: document_image_base64,
  image_mime_type: 'image/png',
});
```

### Product Image Analysis

```typescript
const response = await hazo_llm_image_text({
  prompt: 'Describe this product and list its key features.',
  image_b64: product_image_base64,
  image_mime_type: 'image/jpeg',
});
```

## Error Handling

```typescript
const response = await hazo_llm_text_text({
  prompt: 'Hello world',
});

if (!response.success) {
  logger.error('LLM call failed', { error: response.error });
  // Handle error appropriately
}
```

## Configuration

### File-Based Logging (hazo_logs)

The package includes a built-in Winston-based logger with daily file rotation. Configure logging in your `config/hazo_llm_api_config.ini`:

```ini
[logging]
# Log file path (relative to config directory parent)
logfile=logs/hazo_llm_api.log
# Minimum log level: debug, info, warn, error
level=info
# Max file size before rotation (e.g., '10m', '100k')
max_size=10m
# Max number of rotated files to keep
max_files=5
# Also log to console (true/false)
console_enabled=true
```

#### Using the Built-in Logger

```typescript
import { create_hazo_logger, parse_logging_config } from 'hazo_llm_api/server';

// Parse config from INI file
const config = parse_logging_config('./config/hazo_llm_api_config.ini');

// Create logger instance
const logger = create_hazo_logger(config);

// Pass to initialize_llm_api
await initialize_llm_api({ logger });

// Use directly for application logging
logger.info('Application started');
logger.debug('Debug information', { key: 'value' });
logger.error('Error occurred', { error: err.message });
```

#### Log Output Format

```
2026-01-18 08:22:00.885 [INFO] Logger initialized {"config_path":"..."}
2026-01-18 08:22:01.123 [DEBUG] API call started {"provider":"gemini"}
2026-01-18 08:22:02.456 [ERROR] Request failed {"error":"timeout"}
```

#### Log File Rotation

Log files are automatically rotated:
- Daily rotation with date suffix: `hazo_llm_api-2026-01-18.log`
- Size-based rotation when `max_size` is exceeded
- Old files are deleted when `max_files` limit is reached

#### HazoLoggerConfig Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `log_file` | string | Required | Full path to log file |
| `log_level` | LogLevel | 'info' | Minimum log level (debug, info, warn, error) |
| `max_size` | string | '10m' | Max file size before rotation |
| `max_files` | number | 5 | Max rotated files to keep |
| `console_enabled` | boolean | true | Also log to console |

### Logger Interface

The logger must implement these methods (Winston-compatible):

```typescript
interface Logger {
  error: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
}
```

## License

MIT

## Author

Pubs Abayasiri

## Support

For issues and questions, please visit the [GitHub Issues](https://github.com/pub12/hazo_llm_api/issues) page.
