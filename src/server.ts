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
 * - hazo_llm_text_image_text: Text → Image → Text (chained)
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
  hazo_llm_text_image_text,
  hazo_llm_image_image_text,
  is_initialized,
  get_current_config,
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
} from './lib/database/index.js';

// =============================================================================
// Prompt Utility Exports (Server-side ONLY)
// =============================================================================
export {
  get_prompt_by_area_and_key,
  get_prompt_text,
  get_prompts_by_area,
  get_prompt_by_uuid,
  get_all_prompts,
  substitute_variables,
  parse_prompt_variables,
  validate_variables,
} from './lib/prompts/index.js';

// =============================================================================
// Provider Exports (Server-side ONLY)
// =============================================================================
export {
  call_gemini_api,
  get_gemini_api_url,
} from './lib/providers/index.js';

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
} from './lib/llm_api/types.js';

