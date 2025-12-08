/**
 * Gemini API Client Module
 * 
 * Handles communication with the Google Gemini API.
 * Formats requests according to Gemini API specification and parses responses.
 */

import type {
  Logger,
  Base64Data,
  LLMResponse,
  GeminiRequestBody,
  GeminiPart,
  GeminiApiResponse,
  GeminiGenerationConfig,
  GeminiApiGenerationConfig,
} from '../../llm_api/types.js';

// =============================================================================
// Gemini API Client
// =============================================================================

/**
 * Call the Gemini API with the given prompt and optional image data
 * @param api_url - The Gemini API endpoint URL
 * @param api_key - The API key for authentication
 * @param prompt_text - The text prompt to send
 * @param b64_data - Optional array of base64 encoded images
 * @param logger - Logger instance
 * @param generation_config - Optional generation configuration parameters
 * @returns LLM response with generated text or error
 */
export async function call_gemini_api(
  api_url: string,
  api_key: string,
  prompt_text: string,
  b64_data: Base64Data[] | undefined,
  logger: Logger,
  generation_config?: GeminiGenerationConfig
): Promise<LLMResponse> {
  const file_name = 'gemini_client.ts';
  
  try {
    // Build the request body with optional generation config
    const request_body = build_gemini_request(prompt_text, b64_data, generation_config);
    
    // Convert generation config to API format for logging
    const api_generation_config = build_api_generation_config(generation_config);
    
    // Log the Gemini API call with generation config
    logger.debug('Calling Gemini API', {
      file: file_name,
      line: 42,
      data: {
        api_url,
        prompt_text,
        has_image_data: b64_data && b64_data.length > 0,
        image_count: b64_data?.length || 0,
        generation_config: api_generation_config || 'none (using defaults)',
      },
    });
    
    // Make the API request
    const response = await fetch(api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': api_key,
      },
      body: JSON.stringify(request_body),
    });
    
    // Parse the response
    const response_data = await response.json() as GeminiApiResponse;
    
    // Check for errors
    if (!response.ok || response_data.error) {
      const error_message = response_data.error?.message || `HTTP ${response.status}`;
      logger.error('Gemini API returned error', {
        file: file_name,
        line: 59,
        data: {
          status: response.status,
          error: response_data.error,
        },
      });
      
      return {
        success: false,
        error: error_message,
        raw_response: response_data,
      };
    }
    
    // Extract the generated text from response
    const generated_text = extract_text_from_response(response_data, logger);
    
    if (generated_text) {
      return {
        success: true,
        text: generated_text,
        raw_response: response_data,
      };
    } else {
      logger.warn('No text content in Gemini response', {
        file: file_name,
        line: 84,
        data: { raw_response: response_data },
      });
      
      return {
        success: false,
        error: 'No text content in response',
        raw_response: response_data,
      };
    }
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to call Gemini API', {
      file: file_name,
      line: 97,
      data: { error: error_message },
    });
    
    return {
      success: false,
      error: error_message,
    };
  }
}

// =============================================================================
// Request Building Functions
// =============================================================================

/**
 * Convert snake_case GeminiGenerationConfig to camelCase API format
 * Only includes parameters that are explicitly set (not undefined)
 * @param config - Generation config in snake_case format
 * @returns API-formatted generation config or undefined if no params set
 */
function build_api_generation_config(
  config?: GeminiGenerationConfig
): GeminiApiGenerationConfig | undefined {
  if (!config) {
    return undefined;
  }
  
  const api_config: GeminiApiGenerationConfig = {};
  let has_params = false;
  
  if (config.temperature !== undefined) {
    api_config.temperature = config.temperature;
    has_params = true;
  }
  if (config.max_output_tokens !== undefined) {
    api_config.maxOutputTokens = config.max_output_tokens;
    has_params = true;
  }
  if (config.top_p !== undefined) {
    api_config.topP = config.top_p;
    has_params = true;
  }
  if (config.top_k !== undefined) {
    api_config.topK = config.top_k;
    has_params = true;
  }
  if (config.candidate_count !== undefined) {
    api_config.candidateCount = config.candidate_count;
    has_params = true;
  }
  if (config.stop_sequences !== undefined && config.stop_sequences.length > 0) {
    api_config.stopSequences = config.stop_sequences;
    has_params = true;
  }
  if (config.response_mime_type !== undefined) {
    api_config.responseMimeType = config.response_mime_type;
    has_params = true;
  }
  
  return has_params ? api_config : undefined;
}

/**
 * Build the Gemini API request body
 * @param prompt_text - The text prompt
 * @param b64_data - Optional base64 encoded images
 * @param generation_config - Optional generation configuration parameters
 * @returns Formatted request body for Gemini API
 */
function build_gemini_request(
  prompt_text: string,
  b64_data: Base64Data[] | undefined,
  generation_config?: GeminiGenerationConfig
): GeminiRequestBody {
  const parts: GeminiPart[] = [];
  
  // Add image parts first (if any)
  if (b64_data && b64_data.length > 0) {
    for (const img of b64_data) {
      parts.push({
        inline_data: {
          mime_type: img.mime_type,
          data: img.data,
        },
      });
    }
  }
  
  // Add the text prompt
  parts.push({
    text: prompt_text,
  });
  
  const request_body: GeminiRequestBody = {
    contents: [
      {
        parts,
      },
    ],
  };
  
  // Add generation config if any parameters are set
  const api_generation_config = build_api_generation_config(generation_config);
  if (api_generation_config) {
    request_body.generationConfig = api_generation_config;
  }
  
  return request_body;
}

// =============================================================================
// Response Parsing Functions
// =============================================================================

/**
 * Extract text content from Gemini API response
 * @param response - The Gemini API response
 * @param logger - Logger instance
 * @returns The generated text or null if not found
 */
function extract_text_from_response(
  response: GeminiApiResponse,
  logger: Logger
): string | null {
  const file_name = 'gemini_client.ts';
  
  if (!response.candidates || response.candidates.length === 0) {
    logger.debug('No candidates in response', {
      file: file_name,
      line: 195,
    });
    return null;
  }
  
  const first_candidate = response.candidates[0];
  
  if (!first_candidate.content || !first_candidate.content.parts) {
    logger.debug('No content parts in first candidate', {
      file: file_name,
      line: 204,
    });
    return null;
  }
  
  // Concatenate all text parts
  const text_parts: string[] = [];
  for (const part of first_candidate.content.parts) {
    if ('text' in part && part.text) {
      text_parts.push(part.text);
    }
  }
  
  if (text_parts.length === 0) {
    logger.debug('No text parts found in candidate', {
      file: file_name,
      line: 219,
    });
    return null;
  }
  
  return text_parts.join('');
}

/**
 * Get the default Gemini API URL
 * @param model - The model name (default: gemini-2.5-flash)
 * @returns The API URL
 */
export function get_gemini_api_url(model: string = 'gemini-2.5-flash'): string {
  return `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`;
}

