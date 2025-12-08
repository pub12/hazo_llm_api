/**
 * Library Module Exports
 * 
 * Export all library functions from this module
 */

// LLM API exports
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
} from './llm_api/index.js';

// Type exports
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
} from './llm_api/types.js';

// Database exports
export {
  initialize_database,
  get_database,
  close_database,
  insert_prompt,
  update_prompt,
} from './database/index.js';

// Prompts exports
export {
  get_prompt_by_area_and_key,
  get_prompt_text,
  get_prompts_by_area,
  get_prompt_by_uuid,
  substitute_variables,
  parse_prompt_variables,
  validate_variables,
} from './prompts/index.js';

// Provider exports
export {
  call_gemini_api,
  get_gemini_api_url,
  GeminiProvider,
  type GeminiProviderConfig,
  QwenProvider,
  type QwenProviderConfig,
  call_qwen_api,
  get_qwen_api_url,
  type QwenGenerationConfig,
} from './providers/index.js';

// Provider type exports
export type {
  LLMProvider,
  LLMProviderConfig,
  ServiceType,
  LLMCapabilities,
} from './providers/types.js';

export {
  SERVICE_TYPES,
} from './providers/types.js';

// Provider registry exports
export {
  register_provider,
  set_enabled_llms,
  set_primary_llm,
  get_primary_llm,
  get_provider,
  get_registered_providers,
  is_llm_enabled,
} from './providers/registry.js';

