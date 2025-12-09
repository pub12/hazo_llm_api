/**
 * LLM API Types
 * 
 * TypeScript interfaces and types for the LLM API module.
 * Includes configuration, function parameters, and response types.
 */

import type { ServiceType, ProviderName } from '../providers/types.js';

// =============================================================================
// Logger Interface
// =============================================================================

/**
 * Logger interface matching Winston logger methods
 * Parent application provides this logger instance
 */
export interface Logger {
  error: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
}

// =============================================================================
// LLM API Configuration
// =============================================================================

/**
 * Gemini API generation configuration parameters
 * All parameters are optional - only include in API calls if explicitly set
 *
 * Note: This is used internally by the Gemini provider.
 * Configure via hazo_llm_api_config.ini [llm_gemini] section instead of passing directly.
 */
export interface GeminiGenerationConfig {
  /** Controls randomness in output (0.0-2.0). Lower = more deterministic */
  temperature?: number;
  
  /** Maximum number of tokens in the response */
  max_output_tokens?: number;
  
  /** Nucleus sampling probability (0.0-1.0). Considers tokens up to cumulative probability */
  top_p?: number;
  
  /** Top-k sampling. Considers only the top K most probable tokens */
  top_k?: number;
  
  /** Number of response candidates to generate (1-8) */
  candidate_count?: number;
  
  /** Sequences that stop generation when encountered */
  stop_sequences?: string[];
  
  /** Format of the response: "text/plain" or "application/json" */
  response_mime_type?: string;
}

// =============================================================================
// Hook Types
// =============================================================================

/**
 * Context passed to beforeRequest hook
 */
export interface LLMRequestContext {
  /** Service type being called */
  service_type: ServiceType;

  /** Provider name */
  provider: string;

  /** Request parameters (type varies by service) */
  params: Record<string, unknown>;

  /** Timestamp when request started */
  timestamp: Date;
}

/**
 * Context passed to afterResponse hook
 */
export interface LLMResponseContext extends LLMRequestContext {
  /** The response from the LLM */
  response: LLMResponse;

  /** Duration of the request in milliseconds */
  duration_ms: number;
}

/**
 * Context passed to onError hook
 */
export interface LLMErrorContext extends LLMRequestContext {
  /** The error that occurred */
  error: LLMError;

  /** Duration until error in milliseconds */
  duration_ms: number;
}

/**
 * Hook function called before each LLM request
 * Can be async for logging to external services
 */
export type BeforeRequestHook = (context: LLMRequestContext) => void | Promise<void>;

/**
 * Hook function called after each successful LLM response
 * Can be async for logging/analytics
 */
export type AfterResponseHook = (context: LLMResponseContext) => void | Promise<void>;

/**
 * Hook function called when an error occurs
 * Can be async for error reporting
 */
export type OnErrorHook = (context: LLMErrorContext) => void | Promise<void>;

/**
 * Lifecycle hooks for LLM API calls
 * All hooks are optional and can be async
 *
 * @example
 * ```typescript
 * await initialize_llm_api({
 *   hooks: {
 *     beforeRequest: (ctx) => {
 *       console.log(`Calling ${ctx.provider}.${ctx.service_type}`);
 *     },
 *     afterResponse: (ctx) => {
 *       console.log(`Response in ${ctx.duration_ms}ms`);
 *     },
 *     onError: (ctx) => {
 *       console.error(`Error: ${ctx.error.code}`);
 *     },
 *   },
 * });
 * ```
 */
export interface LLMHooks {
  /** Called before each LLM request */
  beforeRequest?: BeforeRequestHook;

  /** Called after each successful LLM response */
  afterResponse?: AfterResponseHook;

  /** Called when an error occurs */
  onError?: OnErrorHook;
}

// =============================================================================
// LLM API Configuration
// =============================================================================

/**
 * Configuration options for initializing the LLM API
 * Supports provider-based architecture where providers are loaded from config file
 *
 * All configuration fields are optional - the API will use sensible defaults:
 * - logger: Default console logger
 * - sqlite_path: From config file or "prompt_library.sqlite" in cwd
 * - hooks: None
 *
 * @example
 * ```typescript
 * // Minimal initialization
 * await initialize_llm_api({});
 *
 * // With custom logger and hooks
 * await initialize_llm_api({
 *   logger: myLogger,
 *   hooks: {
 *     beforeRequest: (ctx) => console.log(`Calling ${ctx.provider}`),
 *   },
 * });
 * ```
 */
export interface LLMApiConfig {
  /**
   * Logger instance from parent application
   * Optional - if not provided, uses default console logger
   */
  logger?: Logger;

  /**
   * Path to SQLite database file
   * Supports: relative paths, absolute paths, ~ expansion, environment variables
   * Default: "prompt_library.sqlite" (relative to process.cwd())
   */
  sqlite_path?: string;

  /**
   * Lifecycle hooks for monitoring, logging, and analytics
   * Optional - hooks are called at various points during LLM API calls
   */
  hooks?: LLMHooks;
}

// =============================================================================
// Prompt Variable Types
// =============================================================================

/**
 * Single prompt variable key-value pair
 */
export interface PromptVariable {
  [key: string]: string;
}

/**
 * Array of prompt variables for substitution
 * Format: [{ "variable1": "value1", "variable2": "value2" }]
 */
export type PromptVariables = PromptVariable[];

// =============================================================================
// Base64 Data Types
// =============================================================================

/**
 * Base64 encoded data with MIME type
 * Used for sending images/files to LLM APIs
 */
export interface Base64Data {
  /** MIME type of the data (e.g., "image/jpeg", "image/png") */
  mime_type: string;
  
  /** Base64 encoded string of the data */
  data: string;
}

// =============================================================================
// Call LLM Parameters
// =============================================================================

/**
 * Prompt text mode - determines how prompt text is obtained
 */
export type PromptTextMode = 'static' | 'dynamic';

/**
 * Parameters for the call_llm function
 */
export interface CallLLMParams {
  /** Area/category of the prompt (required for dynamic mode) */
  prompt_area?: string;
  
  /** Key identifier for the prompt (required for dynamic mode) */
  prompt_key?: string;
  
  /** Variables to substitute in the prompt text */
  prompt_variables?: PromptVariables;
  
  /** Base64 encoded data to include in the prompt (images, etc.) */
  prompt_b64_data?: Base64Data[];
  
  /** Static prompt text (required for static mode) */
  static_prompt?: string;
  
  /** Mode for obtaining prompt text: "static" uses static_prompt, "dynamic" fetches from database */
  prompt_text_mode: PromptTextMode;
}

// =============================================================================
// Database Types
// =============================================================================

/**
 * Prompt record from the prompts_library table
 */
export interface PromptRecord {
  /** Unique identifier for the prompt */
  uuid: string;
  
  /** Area/category of the prompt */
  prompt_area: string;
  
  /** Key identifier for the prompt */
  prompt_key: string;
  
  /** The actual prompt text */
  prompt_text: string;
  
  /** JSON string of variables used in the prompt */
  prompt_variables: string;
  
  /** Additional notes about the prompt */
  prompt_notes: string;
  
  /** Timestamp when the record was created */
  created_at: string;
  
  /** Timestamp when the record was last changed */
  changed_by: string;
}

// =============================================================================
// LLM Error Types
// =============================================================================

/**
 * Error codes for LLM API errors
 * Use these codes for programmatic error handling
 *
 * @example
 * ```typescript
 * import { LLM_ERROR_CODES } from 'hazo_llm_api/server';
 *
 * if (response.error_info?.code === LLM_ERROR_CODES.RATE_LIMITED) {
 *   // Implement retry logic
 * }
 * ```
 */
export const LLM_ERROR_CODES = {
  /** Provider not found in registry */
  PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',
  /** Provider is not enabled in configuration */
  PROVIDER_NOT_ENABLED: 'PROVIDER_NOT_ENABLED',
  /** Provider does not support the requested service type */
  CAPABILITY_NOT_SUPPORTED: 'CAPABILITY_NOT_SUPPORTED',
  /** API key is missing or invalid */
  API_KEY_MISSING: 'API_KEY_MISSING',
  /** Rate limit exceeded */
  RATE_LIMITED: 'RATE_LIMITED',
  /** Network error (connection failed, timeout, etc.) */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** Invalid request parameters */
  INVALID_REQUEST: 'INVALID_REQUEST',
  /** API returned an error */
  API_ERROR: 'API_ERROR',
  /** Request timed out */
  TIMEOUT: 'TIMEOUT',
  /** Database error */
  DATABASE_ERROR: 'DATABASE_ERROR',
  /** Prompt not found */
  PROMPT_NOT_FOUND: 'PROMPT_NOT_FOUND',
  /** Unknown/unexpected error */
  UNKNOWN: 'UNKNOWN',
} as const;

/**
 * Type for LLM error codes
 */
export type LLMErrorCode = typeof LLM_ERROR_CODES[keyof typeof LLM_ERROR_CODES];

/**
 * Structured error information for LLM API responses
 * Provides detailed error information for programmatic handling
 */
export interface LLMError {
  /** Error code for programmatic handling */
  code: LLMErrorCode;

  /** Human-readable error message */
  message: string;

  /** Whether this error is potentially retryable */
  retryable: boolean;

  /** Original error details (if applicable) */
  details?: Record<string, unknown>;
}

// =============================================================================
// LLM Response Types
// =============================================================================

/**
 * Generic LLM API response
 */
export interface LLMResponse {
  /** Whether the API call was successful */
  success: boolean;

  /** The generated text response from the LLM */
  text?: string;

  /**
   * Error message if the call failed
   * @deprecated Use error_info for structured error data
   */
  error?: string;

  /** Structured error information (new in v2.0) */
  error_info?: LLMError;

  /** Raw response from the API */
  raw_response?: unknown;

  /** Base64 encoded image data (for image output functions) */
  image_b64?: string;

  /** MIME type of the generated image */
  image_mime_type?: string;
}

// =============================================================================
// Streaming Types
// =============================================================================

/**
 * A single chunk from a streaming LLM response
 */
export interface LLMStreamChunk {
  /** The text content of this chunk */
  text: string;

  /** Whether this is the final chunk */
  done: boolean;

  /**
   * Error message if streaming failed
   * @deprecated Use error_info for structured error data
   */
  error?: string;

  /** Structured error information if streaming failed */
  error_info?: LLMError;
}

/**
 * Async iterator for streaming LLM responses
 *
 * @example
 * ```typescript
 * const stream = await hazo_llm_text_text_stream({ prompt: 'Hello' });
 *
 * for await (const chunk of stream) {
 *   if (chunk.error) {
 *     console.error(chunk.error);
 *     break;
 *   }
 *   process.stdout.write(chunk.text);
 *   if (chunk.done) break;
 * }
 * ```
 */
export type LLMStreamResponse = AsyncGenerator<LLMStreamChunk, void, unknown>;

// =============================================================================
// Specialized Function Parameter Types
// =============================================================================

/**
 * Parameters for hazo_llm_text_text (text input → text output)
 */
export interface TextTextParams {
  /** Static prompt text */
  prompt: string;
  
  /** Variables to substitute in the prompt text */
  prompt_variables?: PromptVariables;
  
  /** Area/category for dynamic prompt (optional) */
  prompt_area?: string;
  
  /** Key for dynamic prompt (optional) */
  prompt_key?: string;
}

/**
 * Parameters for hazo_llm_image_text (image input → text output)
 */
export interface ImageTextParams {
  /** Prompt/instruction for analyzing the image */
  prompt: string;
  
  /** Base64 encoded image data */
  image_b64: string;
  
  /** MIME type of the image (e.g., "image/jpeg", "image/png") */
  image_mime_type: string;
  
  /** Variables to substitute in the prompt text */
  prompt_variables?: PromptVariables;
}

/**
 * Parameters for hazo_llm_text_image (text input → image output)
 */
export interface TextImageParams {
  /** Text prompt describing the image to generate */
  prompt: string;
  
  /** Variables to substitute in the prompt text */
  prompt_variables?: PromptVariables;
}

/**
 * Parameters for hazo_llm_image_image (image input → image output)
 */
export interface ImageImageParams {
  /** Prompt/instruction for transforming the image(s) */
  prompt: string;
  
  /** Base64 encoded input image data (for single image, use this OR images array) */
  image_b64?: string;
  
  /** MIME type of the input image (for single image) */
  image_mime_type?: string;
  
  /** Array of input images (for multiple images) */
  images?: Base64Data[];
  
  /** Variables to substitute in the prompt text */
  prompt_variables?: PromptVariables;
}

/**
 * Parameters for hazo_llm_text_image_text (text → image → text)
 * Generates an image from prompt_image, then analyzes it with prompt_text
 */
export interface TextImageTextParams {
  /** Prompt for image generation (step 1) */
  prompt_image: string;
  
  /** Prompt for analyzing the generated image (step 2) */
  prompt_text: string;
  
  /** Variables to substitute in the image generation prompt */
  prompt_image_variables?: PromptVariables;
  
  /** Variables to substitute in the text analysis prompt */
  prompt_text_variables?: PromptVariables;
}

/**
 * Base64 image data for chained operations
 */
export interface ChainImage {
  /** Base64 encoded image data */
  image_b64: string;
  
  /** MIME type of the image */
  image_mime_type: string;
}

/**
 * Parameters for hazo_llm_image_image_text (images → image → text)
 * Chain multiple image transformations, then describe the final result
 * 
 * Flow:
 * 1. Combine images[0] + images[1] using prompts[0] → result_1
 * 2. Combine result_1 + images[2] using prompts[1] → result_2
 * 3. Continue chaining through all images
 * 4. Analyze final result with description_prompt → text output
 * 
 * Requirements:
 * - Minimum 2 images required
 * - Number of prompts = number of images - 1
 */
export interface ImageImageTextParams {
  /** Array of images to chain (minimum 2) */
  images: ChainImage[];
  
  /** Array of transformation prompts (length = images.length - 1) */
  prompts: string[];
  
  /** Final prompt for describing the last generated image */
  description_prompt: string;
  
  /** Variables to substitute in the description prompt */
  description_prompt_variables?: PromptVariables;
}

// =============================================================================
// Gemini-specific Types
// =============================================================================

/**
 * Gemini API text part
 */
export interface GeminiTextPart {
  text: string;
}

/**
 * Gemini API inline data part (for images)
 */
export interface GeminiInlineDataPart {
  inline_data: {
    mime_type: string;
    data: string;
  };
}

/**
 * Gemini API part (either text or inline data)
 */
export type GeminiPart = GeminiTextPart | GeminiInlineDataPart;

/**
 * Gemini API content structure
 */
export interface GeminiContent {
  parts: GeminiPart[];
}

/**
 * Gemini API generation config in request format (camelCase for API)
 */
export interface GeminiApiGenerationConfig {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  candidateCount?: number;
  stopSequences?: string[];
  responseMimeType?: string;
}

/**
 * Gemini API request body
 */
export interface GeminiRequestBody {
  contents: GeminiContent[];
  generationConfig?: GeminiApiGenerationConfig;
}

/**
 * Gemini API response candidate
 */
export interface GeminiCandidate {
  content: {
    parts: Array<{ text: string }>;
    role: string;
  };
  finishReason: string;
  index: number;
}

/**
 * Gemini API response structure
 */
export interface GeminiApiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: {
    safetyRatings: Array<{
      category: string;
      probability: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

// =============================================================================
// LLM API Client Instance
// =============================================================================

/**
 * Initialized LLM API client instance
 */
export interface LLMApiClient {
  /** Configuration used to initialize the client */
  config: LLMApiConfig;

  /** Whether the database has been initialized */
  db_initialized: boolean;

  /** Text input → Text output */
  hazo_llm_text_text: (params: TextTextParams, llm?: ProviderName) => Promise<LLMResponse>;

  /** Image input → Text output (image analysis) */
  hazo_llm_image_text: (params: ImageTextParams, llm?: ProviderName) => Promise<LLMResponse>;

  /** Text input → Image output (image generation) */
  hazo_llm_text_image: (params: TextImageParams, llm?: ProviderName) => Promise<LLMResponse>;

  /** Image input → Image output (image transformation) */
  hazo_llm_image_image: (params: ImageImageParams, llm?: ProviderName) => Promise<LLMResponse>;

  /** Text → Image → Text (generate image then analyze it) */
  hazo_llm_text_image_text: (params: TextImageTextParams, llm?: ProviderName) => Promise<LLMResponse>;

  /** Images → Image → Text (chain image transformations then describe) */
  hazo_llm_image_image_text: (params: ImageImageTextParams, llm?: ProviderName) => Promise<LLMResponse>;
}

