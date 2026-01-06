# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-08

### Added

- **Multi-Provider Architecture**: Extensible LLM provider system with centralized registry
  - Provider interface for implementing new LLM services
  - Registry system for managing multiple providers
  - Support for Gemini and Qwen providers out-of-the-box
  - Per-provider capability declaration and validation

- **Core LLM Service Functions**: Six specialized functions for different input/output combinations
  - `hazo_llm_text_text`: Text input → Text output (standard generation)
  - `hazo_llm_image_text`: Image input → Text output (image analysis)
  - `hazo_llm_text_image`: Text input → Image output (image generation)
  - `hazo_llm_image_image`: Image input → Image output (image transformation)
  - `hazo_llm_text_image_text`: Chained text → image → text operations
  - `hazo_llm_image_image_text`: Chained multi-image → image → text operations

- **Prompt Management System**: SQLite-based prompt storage with caching
  - `prompts_library` table with UUID, area, key, text, variables, and metadata
  - Dynamic prompt retrieval by area and key
  - Variable substitution using `$variable` syntax
  - LRU cache with configurable TTL and size limits
  - Support for prompt notes and version tracking

- **Configuration System**: INI-based configuration with environment variable support
  - `config/hazo_llm_api_config.ini` for package settings
  - `.env.local` for API keys (not committed to git)
  - Per-provider configuration sections (`[llm_gemini]`, `[llm_qwen]`)
  - Generation parameter configuration with prefixes (text_, image_)
  - Enabled LLMs list and primary LLM selection

- **Database Management**: Auto-initialization with sql.js
  - Automatic database creation on module import
  - Schema migration and table creation
  - CRUD operations for prompts
  - Index on prompt_area and prompt_key for performance

- **React Components**: Layout component for consistent UI structure
  - Flexbox-based layout with sidebar and header support
  - CSS classes prefixed with `cls_` for easy identification
  - Full TypeScript support

- **Client/Server Separation**: Dual entry points for proper code splitting
  - `hazo_llm_api` - Client-safe components and types
  - `hazo_llm_api/server` - Server-only LLM API functions and database operations

### Design Decisions

**Why Multi-Provider Architecture?**
- Allows consumers to switch between LLM providers without changing application code
- Enables A/B testing of different models
- Reduces vendor lock-in
- Provides fallback options if a provider is unavailable

**Why INI Configuration Format?**
- Human-readable and easy to edit
- Clear section-based organization
- No indentation sensitivity (unlike YAML)
- Supports both simple values and JSON arrays
- Comments provide inline documentation

**Why Auto-Initialize Database?**
- Reduces boilerplate for consumers
- Ensures database is ready for prompt operations
- Allows separation of database initialization from LLM API key setup
- Graceful degradation if database setup fails

**Why Separate text_ and image_ Generation Configs?**
- Different optimal parameters for text vs image generation
- Text often needs higher temperature for creativity
- Image analysis benefits from lower temperature for accuracy
- Allows fine-tuning per use case

## [Unreleased]

### Planned

- Additional LLM providers (OpenAI, Anthropic, Cohere)
- Streaming response support
- Rate limiting and retry logic with exponential backoff
- Response caching layer
- Testing infrastructure (unit tests, integration tests)
- PostgreSQL support as alternative to SQLite
- Prompt versioning and rollback
- Prompt templates with conditional logic
- Batch processing for multiple prompts

---

## Version History

- **1.0.0** - Initial release with Gemini and Qwen providers, prompt management, and React components
