/**
 * hazo_llm_api Server-Side Exports
 *
 * This file exports server-side only functions for LLM API operations.
 * These should ONLY be imported in server components, API routes, or server actions.
 *
 * Usage: import { initialize_llm_api, hazo_llm_text_text } from 'hazo_llm_api/server'
 *
 * Available functions:
 * - hazo_llm_text_text: Text input → Text output
 * - hazo_llm_image_text: Image input → Text output
 * - hazo_llm_text_image: Text input → Image output
 * - hazo_llm_image_image: Image input → Image output
 * - hazo_llm_document_text: Document input → Text output (PDF analysis)
 * - hazo_llm_text_image_text: Text → Image → Text (chained)
 * - hazo_llm_prompt_chain: Chain multiple prompts with dynamic value resolution
 */

// =============================================================================
// LLM API Exports (Server-side ONLY)
// =============================================================================
export {
  initialize_llm_api,
  hazo_llm_text_text,
  hazo_llm_image_text,
  hazo_llm_text_image,
  hazo_llm_image_image,
  hazo_llm_document_text,
  hazo_llm_text_image_text,
  hazo_llm_image_image_text,
  hazo_llm_prompt_chain,
  // Streaming functions
  hazo_llm_text_text_stream,
  hazo_llm_image_text_stream,
  is_initialized,
  get_current_config,
  // Logger utilities
  default_logger,
  get_logger,
  set_logger,
  // Hooks utilities
  get_hooks,
  set_hooks,
} from './lib/llm_api/index.js';

// =============================================================================
// Database Exports (Server-side ONLY)
// =============================================================================
export {
  initialize_database,
  get_database,
  close_database,
  insert_prompt,
  update_prompt,
  delete_prompt,
  // Path helpers
  get_default_sqlite_path,
  expand_path,
  resolve_sqlite_path,
} from './lib/database/index.js';

// =============================================================================
// Prompt Utility Exports (Server-side ONLY)
// =============================================================================
export {
  get_prompt_by_area_and_key,
  get_prompt_by_area_key_and_locals,
  get_prompt_text,
  get_prompts_by_area,
  get_prompt_by_id,
  get_all_prompts,
  substitute_variables,
  parse_prompt_variables,
  validate_variables,
  type LocalFilterOptions,
} from './lib/prompts/index.js';

// =============================================================================
// Provider Exports (Server-side ONLY)
// =============================================================================
export {
  call_gemini_api,
  get_gemini_api_url,
} from './lib/providers/index.js';

// =============================================================================
// Provider Constants (Type-safe provider names)
// =============================================================================
export { LLM_PROVIDERS, SERVICE_TYPES } from './lib/providers/types.js';
export type { ProviderName, ServiceType } from './lib/providers/types.js';

// =============================================================================
// Error Handling Exports
// =============================================================================
export { LLM_ERROR_CODES } from './lib/llm_api/types.js';
export { build_error_response } from './lib/llm_api/provider_helper.js';
export type { LLMErrorCode, LLMError } from './lib/llm_api/types.js';

// =============================================================================
// Type Re-exports
// =============================================================================
export type {
  LLMApiConfig,
  LLMApiClient,
  LLMResponse,
  TextTextParams,
  ImageTextParams,
  TextImageParams,
  ImageImageParams,
  DocumentTextParams,
  TextImageTextParams,
  ImageImageTextParams,
  ChainImage,
  Logger,
  PromptVariable,
  PromptVariables,
  Base64Data,
  PromptTextMode,
  PromptRecord,
  CallLLMParams,
  // Hook types
  LLMHooks,
  LLMRequestContext,
  LLMResponseContext,
  LLMErrorContext,
  BeforeRequestHook,
  AfterResponseHook,
  OnErrorHook,
  // Streaming types
  LLMStreamChunk,
  LLMStreamResponse,
  // Prompt Chain types
  ChainMatchType,
  ChainFieldDefinition,
  ChainVariableDefinition,
  ChainCallDefinition,
  ChainCallResult,
  PromptChainParams,
  PromptChainResponse,
} from './lib/llm_api/types.js';

