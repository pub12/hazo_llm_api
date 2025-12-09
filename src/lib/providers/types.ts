/**
 * LLM Provider Types
 * 
 * Defines the interface that all LLM providers must implement.
 * This ensures consistent behavior across different LLM implementations.
 */

import type {
  LLMResponse,
  LLMStreamResponse,
  TextTextParams,
  ImageTextParams,
  TextImageParams,
  ImageImageParams,
  Logger,
} from '../llm_api/types.js';

// =============================================================================
// Provider Name Constants
// =============================================================================

/**
 * Provider name constants for type-safe LLM provider selection
 * Use these constants instead of string literals for autocomplete and type safety
 *
 * @example
 * ```typescript
 * import { LLM_PROVIDERS } from 'hazo_llm_api/server';
 *
 * const response = await hazo_llm_text_text(params, LLM_PROVIDERS.GEMINI);
 * ```
 */
export const LLM_PROVIDERS = {
  GEMINI: 'gemini',
  QWEN: 'qwen',
} as const;

/**
 * Type for provider name - union of all valid provider names
 * Accepts both constants and string literals for backward compatibility
 *
 * @example
 * ```typescript
 * // Using constant (recommended)
 * const provider: ProviderName = LLM_PROVIDERS.GEMINI;
 *
 * // Using string literal (still works)
 * const provider: ProviderName = 'gemini';
 *
 * // Custom provider (also valid)
 * const provider: ProviderName = 'my-custom-provider';
 * ```
 */
export type ProviderName = typeof LLM_PROVIDERS[keyof typeof LLM_PROVIDERS] | (string & {});

// =============================================================================
// Service Type Constants
// =============================================================================

/**
 * Service type identifiers for LLM capabilities
 */
export const SERVICE_TYPES = {
  TEXT_TEXT: 'text_text',
  IMAGE_TEXT: 'image_text',
  TEXT_IMAGE: 'text_image',
  IMAGE_IMAGE: 'image_image',
} as const;

/**
 * Service type string literal union
 */
export type ServiceType = typeof SERVICE_TYPES[keyof typeof SERVICE_TYPES];

/**
 * Set of capabilities that a provider supports
 */
export type LLMCapabilities = Set<ServiceType>;

// =============================================================================
// LLM Provider Interface
// =============================================================================

/**
 * Interface that all LLM providers must implement
 * Providers handle the specific API calls and transformations for their LLM service
 */
export interface LLMProvider {
  /**
   * Get the name/identifier of this provider (e.g., "gemini", "openai")
   */
  get_name(): string;
  
  /**
   * Get the capabilities this provider supports
   * @returns Set of supported service types
   */
  get_capabilities(): LLMCapabilities;
  
  /**
   * Get the model name configured for a specific service type
   * @param service_type - The service type to get the model for
   * @returns Model name/identifier or undefined if not configured for this service
   */
  get_model_for_service(service_type: ServiceType): string | undefined;
  
  /**
   * Text input → Text output
   * Generate text from a text prompt
   * 
   * @param params - Text input parameters
   * @param logger - Logger instance
   * @returns LLM response with generated text
   */
  text_text(params: TextTextParams, logger: Logger): Promise<LLMResponse>;
  
  /**
   * Image input → Text output
   * Analyze an image and generate text description
   * 
   * @param params - Image input parameters
   * @param logger - Logger instance
   * @returns LLM response with generated text
   */
  image_text(params: ImageTextParams, logger: Logger): Promise<LLMResponse>;
  
  /**
   * Text input → Image output
   * Generate an image from a text prompt
   * 
   * @param params - Text input parameters for image generation
   * @param logger - Logger instance
   * @returns LLM response with generated image
   */
  text_image(params: TextImageParams, logger: Logger): Promise<LLMResponse>;
  
  /**
   * Image input → Image output
   * Transform/edit an image based on instructions
   *
   * @param params - Image input parameters with transformation instructions
   * @param logger - Logger instance
   * @returns LLM response with transformed image
   */
  image_image(params: ImageImageParams, logger: Logger): Promise<LLMResponse>;

  // =========================================================================
  // Streaming Methods (Optional)
  // =========================================================================

  /**
   * Text input → Text output (streaming)
   * Generate text from a text prompt with streaming response
   *
   * @param params - Text input parameters
   * @param logger - Logger instance
   * @returns Async generator yielding text chunks
   */
  text_text_stream?(params: TextTextParams, logger: Logger): Promise<LLMStreamResponse>;

  /**
   * Image input → Text output (streaming)
   * Analyze an image and generate text description with streaming response
   *
   * @param params - Image input parameters
   * @param logger - Logger instance
   * @returns Async generator yielding text chunks
   */
  image_text_stream?(params: ImageTextParams, logger: Logger): Promise<LLMStreamResponse>;
}

// =============================================================================
// Provider Configuration
// =============================================================================

/**
 * Base configuration for initializing an LLM provider
 */
export interface LLMProviderConfig {
  /** Provider name/identifier (e.g., "gemini", "openai") */
  name: string;
  
  /** API key - should be read from .env.local (e.g., GEMINI_API_KEY) */
  api_key?: string;
  
  /** Logger instance */
  logger: Logger;
  
  /** Additional provider-specific configuration */
  [key: string]: unknown;
}

