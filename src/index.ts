/**
 * hazo_llm_api Package Entry Point
 * 
 * Main export file for the hazo_llm_api npm package.
 * 
 * IMPORTANT: This file only exports CLIENT-SIDE safe components.
 * For server-side LLM API functions, import from 'hazo_llm_api/server'
 */

// =============================================================================
// Component Exports (Client-side ONLY)
// =============================================================================
export * from './components/index.js';

// =============================================================================
// Provider Constants (Type-safe provider names - safe for client)
// =============================================================================
export { LLM_PROVIDERS, SERVICE_TYPES } from './lib/providers/types.js';
export type { ProviderName, ServiceType } from './lib/providers/types.js';

// =============================================================================
// Error Constants (safe for client)
// =============================================================================
export { LLM_ERROR_CODES } from './lib/llm_api/types.js';
export type { LLMErrorCode, LLMError } from './lib/llm_api/types.js';

// =============================================================================
// Type exports (safe for both client and server)
// =============================================================================
export type {
  LLMApiConfig,
  LLMApiClient,
  CallLLMParams,
  LLMResponse,
  Logger,
  PromptVariable,
  PromptVariables,
  Base64Data,
  PromptTextMode,
  PromptRecord,
} from './lib/llm_api/types.js';
