/**
 * Qwen API Client Module
 * 
 * Handles communication with Alibaba Cloud DashScope Qwen API.
 * Uses OpenAI-compatible chat completions endpoint.
 */

import type {
  Logger,
  Base64Data,
  LLMResponse,
} from '../../llm_api/types.js';

// =============================================================================
// Qwen API Types
// =============================================================================

/**
 * Qwen generation configuration parameters
 * Maps to OpenAI-compatible parameters
 */
export interface QwenGenerationConfig {
  /** Controls randomness in output (0.0-2.0). Lower = more deterministic */
  temperature?: number;
  
  /** Maximum number of tokens in the response */
  max_tokens?: number;
  
  /** Top-p sampling (nucleus sampling) */
  top_p?: number;
  
  /** Top-k sampling */
  top_k?: number;
  
  /** Number of completion choices to generate */
  n?: number;
  
  /** Stop sequences */
  stop?: string[];
  
  /** Presence penalty */
  presence_penalty?: number;
  
  /** Frequency penalty */
  frequency_penalty?: number;
}

/**
 * Qwen API message role
 */
export type QwenMessageRole = 'system' | 'user' | 'assistant';

/**
 * Qwen API message
 */
export interface QwenMessage {
  role: QwenMessageRole;
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
}

/**
 * Qwen API request body
 */
export interface QwenApiRequest {
  model: string;
  messages: QwenMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  n?: number;
  stop?: string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  result_format?: 'message' | 'text';
  stream?: boolean;
}

/**
 * Qwen API response choice
 */
export interface QwenChoice {
  index: number;
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

/**
 * Qwen API response
 */
export interface QwenApiResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: QwenChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message: string;
    type: string;
    code?: string;
  };
}

// =============================================================================
// Qwen API Client
// =============================================================================

/**
 * Call the Qwen API with messages and optional image data
 * @param api_url - The Qwen API endpoint URL
 * @param api_key - The API key for authentication
 * @param model - The model name to use
 * @param messages - Array of messages (system + user)
 * @param logger - Logger instance
 * @param generation_config - Optional generation configuration parameters
 * @returns LLM response with generated text or error
 */
export async function call_qwen_api(
  api_url: string,
  api_key: string,
  model: string,
  messages: QwenMessage[],
  logger: Logger,
  generation_config?: QwenGenerationConfig
): Promise<LLMResponse> {
  const file_name = 'qwen_client.ts';
  
  try {
    // Build the request body
    const request_body: QwenApiRequest = {
      model,
      messages,
    };
    
    // Add generation config parameters if provided
    if (generation_config) {
      if (generation_config.temperature !== undefined) {
        request_body.temperature = generation_config.temperature;
      }
      if (generation_config.max_tokens !== undefined) {
        request_body.max_tokens = generation_config.max_tokens;
      }
      if (generation_config.top_p !== undefined) {
        request_body.top_p = generation_config.top_p;
      }
      if (generation_config.top_k !== undefined) {
        request_body.top_k = generation_config.top_k;
      }
      if (generation_config.n !== undefined) {
        request_body.n = generation_config.n;
      }
      if (generation_config.stop !== undefined && generation_config.stop.length > 0) {
        request_body.stop = generation_config.stop;
      }
      if (generation_config.presence_penalty !== undefined) {
        request_body.presence_penalty = generation_config.presence_penalty;
      }
      if (generation_config.frequency_penalty !== undefined) {
        request_body.frequency_penalty = generation_config.frequency_penalty;
      }
    }
    
    // Log the API call
    logger.debug('Calling Qwen API', {
      file: file_name,
      line: 125,
      data: {
        api_url,
        model,
        message_count: messages.length,
        has_generation_config: !!generation_config,
        generation_config: generation_config || 'none (using defaults)',
      },
    });
    
    // Make the API request
    const response = await fetch(api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key}`,
      },
      body: JSON.stringify(request_body),
    });
    
    // Parse the response
    const response_data = await response.json() as QwenApiResponse;
    
    // Check for errors
    if (!response.ok || response_data.error) {
      const error_message = response_data.error?.message || `HTTP ${response.status}`;
      logger.error('Qwen API returned error', {
        file: file_name,
        line: 152,
        data: {
          status: response.status,
          error: response_data.error,
          request_model: model,
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
      logger.warn('No text content in Qwen response', {
        file: file_name,
        line: 177,
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
    logger.error('Failed to call Qwen API', {
      file: file_name,
      line: 188,
      data: { error: error_message, model },
    });
    
    return {
      success: false,
      error: error_message,
    };
  }
}

// =============================================================================
// Response Parsing Functions
// =============================================================================

/**
 * Extract text content from Qwen API response
 * @param response - The Qwen API response
 * @param logger - Logger instance
 * @returns The generated text or null if not found
 */
function extract_text_from_response(
  response: QwenApiResponse,
  logger: Logger
): string | null {
  const file_name = 'qwen_client.ts';
  
  if (!response.choices || response.choices.length === 0) {
    logger.debug('No choices in Qwen response', {
      file: file_name,
      line: 210,
    });
    return null;
  }
  
  const first_choice = response.choices[0];
  
  if (!first_choice.message || !first_choice.message.content) {
    logger.debug('No message content in first choice', {
      file: file_name,
      line: 218,
    });
    return null;
  }
  
  return first_choice.message.content;
}

/**
 * Get the default Qwen API URL
 * @returns The default DashScope API URL
 */
export function get_qwen_api_url(): string {
  return 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
}

/**
 * Get the DashScope image generation API URL
 * @param model - The model name (e.g., qwen-image-plus)
 * @returns The DashScope image generation API URL
 */
export function get_qwen_image_api_url(model?: string): string {
  // DashScope image generation endpoint format
  // Try the standard text-to-image endpoint first
  return 'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';
}

/**
 * Get the DashScope image editing API URL
 * @param model - The model name (e.g., qwen-image-edit)
 * @returns The DashScope image editing API URL
 */
export function get_qwen_image_edit_api_url(model?: string): string {
  // DashScope image editing uses MultiModalConversation API
  // Uses the same chat completions endpoint as other multimodal operations
  return 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
}

/**
 * Build Qwen messages array from prompt and optional images
 * @param prompt - The text prompt
 * @param system_instruction - Optional system instruction
 * @param b64_data - Optional array of base64 encoded images
 * @returns Array of Qwen messages
 */
export function build_qwen_messages(
  prompt: string,
  system_instruction?: string,
  b64_data?: Base64Data[]
): QwenMessage[] {
  const messages: QwenMessage[] = [];
  
  // Add system message if provided
  if (system_instruction) {
    messages.push({
      role: 'system',
      content: system_instruction,
    });
  }
  
  // Build user message content
  if (b64_data && b64_data.length > 0) {
    // Multi-modal message with images
    const content: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> = [];
    
    // Add images first
    for (const img of b64_data) {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${img.mime_type};base64,${img.data}`,
        },
      });
    }
    
    // Add text prompt
    content.push({
      type: 'text',
      text: prompt,
    });
    
    messages.push({
      role: 'user',
      content,
    });
  } else {
    // Text-only message
    messages.push({
      role: 'user',
      content: prompt,
    });
  }
  
  return messages;
}

/**
 * Call the DashScope image generation API
 * @param api_url - The DashScope image generation API endpoint URL
 * @param api_key - The API key for authentication
 * @param model - The model name to use (e.g., qwen-image-plus)
 * @param prompt - The text prompt for image generation
 * @param logger - Logger instance
 * @param generation_config - Optional generation configuration parameters
 * @returns LLM response with generated image or error
 */
export async function call_qwen_image_api(
  api_url: string,
  api_key: string,
  model: string,
  prompt: string,
  logger: Logger,
  generation_config?: QwenGenerationConfig
): Promise<LLMResponse> {
  const file_name = 'qwen_client.ts';
  
  try {
    // Build the request body for image generation
    // DashScope image generation API format
    // Allowed sizes: 1664*928, 1472*1140, 1328*1328, 1140*1472, 928*1664
    const request_body: Record<string, unknown> = {
      model,
      input: {
        prompt,
      },
      parameters: {
        // Use square format as default (1328*1328)
        size: '1328*1328',
      },
    };
    
    // Add generation config parameters if provided
    // Note: DashScope image generation may support different parameters
    // For now, we'll use basic parameters
    if (generation_config) {
      const params: Record<string, unknown> = {};
      if (generation_config.n !== undefined) {
        params.n = generation_config.n;
      }
      // Add other parameters as needed for image generation
      if (Object.keys(params).length > 0) {
        request_body.parameters = params;
      }
    }
    
    // Log the API call
    logger.debug('Calling DashScope image generation API', {
      file: file_name,
      line: 380,
      data: {
        api_url,
        model,
        prompt_length: prompt.length,
        has_generation_config: !!generation_config,
      },
    });
    
    // Make the API request
    // DashScope image generation requires async mode
    const response = await fetch(api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key}`,
        'X-DashScope-Async': 'enable', // Enable async mode
      },
      body: JSON.stringify(request_body),
    });
    
    // Parse the response - handle both JSON and text responses
    type DashScopeImageResponse = {
      output?: {
        task_id?: string;
        results?: Array<{
          url?: string;
        }>;
      };
      task_id?: string;
      request_id?: string;
      error?: {
        message: string;
        code?: string;
      };
      code?: string;
      message?: string;
      task_status?: string;
      status?: string;
    };
    
    let parsed_response: DashScopeImageResponse;
    const response_text = await response.text();
    
    try {
      parsed_response = JSON.parse(response_text) as DashScopeImageResponse;
      // Log the initial response to see what we get
      logger.debug('DashScope image generation initial response', {
        file: file_name,
        line: 450,
        data: {
          status: response.status,
          response_preview: response_text.substring(0, 1000),
        },
      });
    } catch {
      // If not JSON, use the text as error message
      parsed_response = { error: { message: response_text } };
    }
    
    // Check for errors
    if (!response.ok || parsed_response.error || parsed_response.code) {
      const error_message = parsed_response.error?.message || 
                           parsed_response.message || 
                           `HTTP ${response.status}: ${response_text.substring(0, 500)}`;
      logger.error('DashScope image generation API returned error', {
        file: file_name,
        line: 420,
        data: {
          status: response.status,
          status_text: response.statusText,
          error: parsed_response.error,
          code: parsed_response.code,
          message: parsed_response.message,
          request_model: model,
          request_body: JSON.stringify(request_body),
          full_response: response_text.substring(0, 1000), // Limit to first 1000 chars
        },
      });
      
      return {
        success: false,
        error: error_message,
        raw_response: parsed_response,
      };
    }
    
    // Handle async task - if task_id is returned, we need to poll for results
    const task_id = parsed_response.output?.task_id || parsed_response.task_id;
    if (task_id && !parsed_response.output?.results) {
      // Async mode - poll for results
      logger.info('DashScope returned async task_id, polling for results', {
        file: file_name,
        line: 440,
        data: { task_id },
      });
      
      // Poll the task status endpoint
      // DashScope uses: /api/v1/tasks/{task_id}
      const status_url = `https://dashscope-intl.aliyuncs.com/api/v1/tasks/${task_id}`;
      let attempts = 0;
      const max_attempts = 60; // Poll for up to 60 seconds (image generation can take time)
      
      while (attempts < max_attempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between polls
        
        const status_response = await fetch(status_url, {
          headers: {
            'Authorization': `Bearer ${api_key}`,
          },
        });
        
        if (!status_response.ok) {
          const error_text = await status_response.text();
          logger.warn('Task status check failed', {
            file: file_name,
            line: 510,
            data: { status: status_response.status, error: error_text },
          });
          attempts++;
          continue;
        }
        
        const status_data_raw = await status_response.json();
        const status_data = status_data_raw as DashScopeImageResponse;
        
        // Check task status FIRST - if it's "FAILED" or "CANCELED", return error immediately
        const task_status = (status_data_raw as { output?: { task_status?: string } }).output?.task_status || 
                           (status_data_raw as { task_status?: string }).task_status || 
                           (status_data_raw as { status?: string }).status;
        
        // Log the status response for debugging (less frequently to reduce log noise)
        if (attempts % 5 === 0 || task_status === 'FAILED' || task_status === 'SUCCEEDED') {
          logger.debug('Polling task status response', {
            file: file_name,
            line: 530,
            data: { 
              task_id, 
              attempt: attempts + 1, 
              max_attempts,
              response_status: status_response.status,
              task_status,
              response_data: JSON.stringify(status_data_raw).substring(0, 500), // First 500 chars
            },
          });
        }
        
        // Check for FAILED or CANCELED status immediately
        if (task_status === 'FAILED' || task_status === 'CANCELED') {
          // Extract error message from output if available
          const output = (status_data_raw as { output?: { message?: string; code?: string } }).output;
          const error_msg = output?.message || 
                           status_data.error?.message || 
                           status_data.message || 
                           `Task ${task_status.toLowerCase()}`;
          logger.error('Image generation task failed', {
            file: file_name,
            line: 545,
            data: { task_id, task_status, error_code: output?.code, error_message: error_msg },
          });
          return {
            success: false,
            error: error_msg,
            raw_response: status_data,
          };
        }
        
        // Check if task is complete and has results
        // DashScope may return results in different structures
        if (status_data.output?.results && status_data.output.results.length > 0) {
          // Results are ready
          parsed_response.output = status_data.output;
          break;
        }
        
        // Also check for direct results in response (some API versions)
        if ((status_data_raw as { results?: unknown[] }).results && 
            Array.isArray((status_data_raw as { results: unknown[] }).results) &&
            (status_data_raw as { results: unknown[] }).results.length > 0) {
          parsed_response.output = {
            results: (status_data_raw as { results: Array<{ url?: string }> }).results,
          };
          break;
        }
        
        // If task is SUCCEEDED but no results yet, continue polling
        if (task_status === 'SUCCEEDED') {
          // Results should be available, but if not, continue polling
          attempts++;
          continue;
        }
        
        // Check for task failure in error fields
        if (status_data.error || status_data.code) {
          const error_msg = status_data.error?.message || status_data.message || 'Task failed';
          return {
            success: false,
            error: error_msg,
            raw_response: status_data,
          };
        }
        
        // If task is still PENDING or RUNNING, continue polling
        if (task_status === 'PENDING' || task_status === 'RUNNING' || !task_status) {
          attempts++;
          continue;
        }
        
        // Default: continue polling
        attempts++;
      }
      
      if (attempts >= max_attempts) {
        return {
          success: false,
          error: 'Image generation timed out - task did not complete in time',
          raw_response: parsed_response,
        };
      }
    }
    
    // Extract image URL from response
    const results = parsed_response.output?.results;
    if (results && results.length > 0 && results[0].url) {
      // Fetch the image from the URL and convert to base64
      const image_url = results[0].url;
      const image_response = await fetch(image_url);
      if (!image_response.ok) {
        return {
          success: false,
          error: `Failed to fetch generated image: HTTP ${image_response.status}`,
        };
      }
      const image_array_buffer = await image_response.arrayBuffer();
      // Convert ArrayBuffer to base64 in chunks to avoid stack overflow
      const uint8_array = new Uint8Array(image_array_buffer);
      const chunk_size = 8192; // Process in 8KB chunks
      let binary_string = '';
      
      for (let i = 0; i < uint8_array.length; i += chunk_size) {
        const chunk = uint8_array.slice(i, i + chunk_size);
        binary_string += String.fromCharCode(...chunk);
      }
      
      const image_base64 = btoa(binary_string);
      
      // Get content type from response headers
      const content_type = image_response.headers.get('content-type') || 'image/png';
      
      return {
        success: true,
        image_b64: image_base64,
        image_mime_type: content_type,
        raw_response: parsed_response,
      };
    }
    
    logger.warn('No image URL in DashScope response', {
      file: file_name,
      line: 470,
      data: { raw_response: parsed_response },
    });
    
    return {
      success: false,
      error: 'No image URL in response',
      raw_response: parsed_response,
    };
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to call DashScope image generation API', {
      file: file_name,
      line: 480,
      data: { error: error_message, model },
    });
    
    return {
      success: false,
      error: error_message,
    };
  }
}

/**
 * Call the DashScope image editing API
 * @param api_url - The DashScope image editing API endpoint URL
 * @param api_key - The API key for authentication
 * @param model - The model name to use (e.g., qwen-image-edit)
 * @param prompt - The text prompt describing the transformation
 * @param input_images - Array of base64 encoded input images with mime types (1-3 images supported)
 * @param logger - Logger instance
 * @param generation_config - Optional generation configuration parameters
 * @returns LLM response with edited image or error
 */
export async function call_qwen_image_edit_api(
  api_url: string,
  api_key: string,
  model: string,
  prompt: string,
  input_images: Base64Data[],
  logger: Logger,
  generation_config?: QwenGenerationConfig
): Promise<LLMResponse> {
  const file_name = 'qwen_client.ts';
  
  try {
    // Check if this is the multimodal generation endpoint (different format)
    const is_multimodal_endpoint = api_url.includes('/multimodal-generation/');
    
    let request_body: Record<string, unknown>;
    
    if (is_multimodal_endpoint) {
      // Multimodal generation endpoint uses input format with images array
      // Support multiple images (1-3 images as per API requirements)
      const content: Array<{ image?: string; text?: string }> = [];
      
      // Add all images first
      for (const img of input_images) {
        content.push({
          image: `data:${img.mime_type};base64,${img.data}`,
        });
      }
      
      // Add text prompt after images
      content.push({
        text: prompt,
      });
      
      request_body = {
        model,
        input: {
          messages: [
            {
              role: 'user',
              content,
            },
          ],
        },
        parameters: {
          result_format: 'message',
        },
      };
    } else {
      // Chat completions endpoint uses messages format
      // Support multiple images
      const messages = build_qwen_messages(prompt, undefined, input_images);
      
      request_body = {
        model,
        messages,
        result_format: 'message', // Required for multimodal responses with images
        stream: false, // Disable streaming for image editing
      };
    }
    
    // Add generation config parameters if provided
    if (generation_config) {
      if (is_multimodal_endpoint) {
        // For multimodal endpoint, add to parameters object
        const params = request_body.parameters as Record<string, unknown>;
        if (generation_config.temperature !== undefined) {
          params.temperature = generation_config.temperature;
        }
        if (generation_config.max_tokens !== undefined) {
          params.max_tokens = generation_config.max_tokens;
        }
        if (generation_config.top_p !== undefined) {
          params.top_p = generation_config.top_p;
        }
        if (generation_config.top_k !== undefined) {
          params.top_k = generation_config.top_k;
        }
      } else {
        // For chat completions endpoint, add to root
        if (generation_config.temperature !== undefined) {
          request_body.temperature = generation_config.temperature;
        }
        if (generation_config.max_tokens !== undefined) {
          request_body.max_tokens = generation_config.max_tokens;
        }
        if (generation_config.top_p !== undefined) {
          request_body.top_p = generation_config.top_p;
        }
        if (generation_config.top_k !== undefined) {
          request_body.top_k = generation_config.top_k;
        }
        if (generation_config.n !== undefined) {
          request_body.n = generation_config.n;
        }
        if (generation_config.stop !== undefined && generation_config.stop.length > 0) {
          request_body.stop = generation_config.stop;
        }
        if (generation_config.presence_penalty !== undefined) {
          request_body.presence_penalty = generation_config.presence_penalty;
        }
        if (generation_config.frequency_penalty !== undefined) {
          request_body.frequency_penalty = generation_config.frequency_penalty;
        }
      }
    }
    
    // Log the API call
    logger.debug('Calling DashScope image editing API', {
      file: file_name,
      line: 730,
      data: {
        api_url,
        model,
        prompt_length: prompt.length,
        image_count: input_images.length,
        image_mime_types: input_images.map(img => img.mime_type),
        has_generation_config: !!generation_config,
      },
    });
    
    // Make the API request
    // DashScope image editing uses chat completions endpoint
    const response = await fetch(api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key}`,
      },
      body: JSON.stringify(request_body),
    });
    
    // Parse the response - handle both chat completions and multimodal generation formats
    const raw_response = await response.json();
    
    // Log the initial response
    logger.debug('DashScope image editing initial response', {
      file: file_name,
      line: 854,
      data: {
        status: response.status,
        response_preview: JSON.stringify(raw_response).substring(0, 1000),
      },
    });
    
    // Check for errors (handle both response formats)
    // For multimodal endpoint, successful responses have 'output' field, errors have 'error' or 'code' field
    if (!response.ok) {
      // HTTP error status
      const error_data = (raw_response as { error?: { message?: string } }).error;
      const error_message = error_data?.message || 
                           (raw_response as { message?: string })?.message || 
                           `HTTP ${response.status}`;
      logger.error('DashScope image editing API returned HTTP error', {
        file: file_name,
        line: 870,
        data: {
          status: response.status,
          error: error_data,
          request_model: model,
        },
      });
      
      return {
        success: false,
        error: error_message,
        raw_response: raw_response,
      };
    }
    
    // Check for API-level errors in response body
    // Only check for actual error fields, not the entire response object
    const error_field = (raw_response as { error?: { message?: string } }).error;
    const error_code = (raw_response as { code?: string }).code;
    const has_error = error_field !== undefined || (error_code !== undefined && error_code !== '200' && error_code !== 'Success');
    
    if (has_error) {
      const error_message = error_field?.message || 
                           (raw_response as { message?: string })?.message || 
                           `API returned error code: ${error_code}`;
      logger.error('DashScope image editing API returned error', {
        file: file_name,
        line: 895,
        data: {
          status: response.status,
          error: error_field || { code: error_code, message: (raw_response as { message?: string })?.message },
          request_model: model,
        },
      });
      
      return {
        success: false,
        error: error_message,
        raw_response: raw_response,
      };
    }
    
    // Handle multimodal generation endpoint response format (wraps in output object)
    let response_data: QwenApiResponse;
    let raw_response_data: unknown = raw_response;
    
    if (is_multimodal_endpoint && (raw_response as { output?: unknown }).output) {
      // Multimodal generation endpoint wraps response in output object
      const multimodal_response = raw_response as { output: QwenApiResponse; usage?: unknown; request_id?: string };
      response_data = multimodal_response.output;
      raw_response_data = multimodal_response; // Keep full response for logging
    } else {
      // Chat completions format (direct response)
      response_data = raw_response as QwenApiResponse;
    }
    
    // Extract image from response
    // For image editing, the response content may contain image URLs or base64 data
    if (!response_data.choices || response_data.choices.length === 0) {
      logger.warn('No choices in DashScope image editing response', {
        file: file_name,
        line: 843,
        data: { 
          raw_response: response_data,
          response_keys: Object.keys(response_data || {}),
          full_response: JSON.stringify(response_data, null, 2).substring(0, 2000),
        },
      });
      return {
        success: false,
        error: 'No content in response - API returned no choices. Check logs for full response details.',
        raw_response: response_data,
      };
    }
    
    const first_choice = response_data.choices[0];
    const content = first_choice.message?.content;
    
    if (!content) {
      logger.warn('No content in first choice', {
        file: file_name,
        line: 920,
        data: { 
          raw_response: response_data,
          first_choice: first_choice,
          message: first_choice.message,
          full_response: JSON.stringify(response_data, null, 2).substring(0, 2000),
        },
      });
      return {
        success: false,
        error: 'No content in response - message has no content. Check logs for full response details.',
        raw_response: response_data,
      };
    }
    
    // Handle multimodal generation endpoint format - content is array with {image: "url"} objects
    if (Array.isArray(content)) {
      const content_array = content as Array<{ image?: string; text?: string; type?: string; image_url?: { url: string } }>;
      for (const item of content_array) {
        // Check for multimodal format: {image: "url"} (multimodal generation endpoint)
        if (item.image && typeof item.image === 'string') {
          const image_url = item.image;
          try {
            const image_response = await fetch(image_url);
            if (!image_response.ok) {
              return {
                success: false,
                error: `Failed to fetch edited image: HTTP ${image_response.status}`,
              };
            }
            const image_array_buffer = await image_response.arrayBuffer();
            const uint8_array = new Uint8Array(image_array_buffer);
            const chunk_size = 8192;
            let binary_string = '';
            
            for (let i = 0; i < uint8_array.length; i += chunk_size) {
              const chunk = uint8_array.slice(i, i + chunk_size);
              binary_string += String.fromCharCode(...chunk);
            }
            
            const image_base64 = btoa(binary_string);
            const content_type = image_response.headers.get('content-type') || 'image/png';
            
            return {
              success: true,
              image_b64: image_base64,
              image_mime_type: content_type,
              raw_response: response_data,
            };
          } catch (fetch_error) {
            logger.error('Failed to fetch image from URL', {
              file: file_name,
              line: 960,
              data: { error: fetch_error instanceof Error ? fetch_error.message : String(fetch_error), url: image_url },
            });
            return {
              success: false,
              error: 'Failed to fetch image from URL in response',
              raw_response: response_data,
            };
          }
        }
        // Check for chat completions format: {image_url: {url: "..."}}
        if (item.image_url?.url) {
          const image_url = item.image_url.url;
          // Handle data URLs
          if (image_url.startsWith('data:')) {
            const base64_match = image_url.match(/data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/);
            if (base64_match) {
              const mime_type = `image/${base64_match[1]}`;
              const base64_data = base64_match[2];
              return {
                success: true,
                image_b64: base64_data,
                image_mime_type: mime_type,
                raw_response: response_data,
              };
            }
          } else {
            // Fetch from URL
            try {
              const image_response = await fetch(image_url);
              if (!image_response.ok) {
                return {
                  success: false,
                  error: `Failed to fetch edited image: HTTP ${image_response.status}`,
                };
              }
              const image_array_buffer = await image_response.arrayBuffer();
              const uint8_array = new Uint8Array(image_array_buffer);
              const chunk_size = 8192;
              let binary_string = '';
              
              for (let i = 0; i < uint8_array.length; i += chunk_size) {
                const chunk = uint8_array.slice(i, i + chunk_size);
                binary_string += String.fromCharCode(...chunk);
              }
              
              const image_base64 = btoa(binary_string);
              const content_type = image_response.headers.get('content-type') || 'image/png';
              
              return {
                success: true,
                image_b64: image_base64,
                image_mime_type: content_type,
                raw_response: response_data,
              };
            } catch (fetch_error) {
              logger.error('Failed to fetch image from URL', {
                file: file_name,
                line: 1000,
                data: { error: fetch_error instanceof Error ? fetch_error.message : String(fetch_error), url: image_url },
              });
              return {
                success: false,
                error: 'Failed to fetch image from URL in response',
                raw_response: response_data,
              };
            }
          }
        }
      }
    }
    
    // Check if content is a string (might contain image URL or base64)
    if (typeof content === 'string') {
      // Try to extract image URL or base64 from content
      // Image URLs typically start with http:// or https://
      const url_match = content.match(/https?:\/\/[^\s]+/);
      if (url_match) {
        const image_url = url_match[0];
        try {
          const image_response = await fetch(image_url);
          if (!image_response.ok) {
            return {
              success: false,
              error: `Failed to fetch edited image: HTTP ${image_response.status}`,
            };
          }
          const image_array_buffer = await image_response.arrayBuffer();
          const uint8_array = new Uint8Array(image_array_buffer);
          const chunk_size = 8192;
          let binary_string = '';
          
          for (let i = 0; i < uint8_array.length; i += chunk_size) {
            const chunk = uint8_array.slice(i, i + chunk_size);
            binary_string += String.fromCharCode(...chunk);
          }
          
          const image_base64 = btoa(binary_string);
          const content_type = image_response.headers.get('content-type') || 'image/png';
          
          return {
            success: true,
            image_b64: image_base64,
            image_mime_type: content_type,
            raw_response: response_data,
          };
        } catch (fetch_error) {
          logger.error('Failed to fetch image from URL', {
            file: file_name,
            line: 890,
            data: { error: fetch_error instanceof Error ? fetch_error.message : String(fetch_error), url: image_url },
          });
          return {
            success: false,
            error: 'Failed to fetch image from URL in response',
            raw_response: response_data,
          };
        }
      }
      
      // Check if content contains base64 image data
      const base64_match = content.match(/data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/);
      if (base64_match) {
        const mime_type = `image/${base64_match[1]}`;
        const base64_data = base64_match[2];
        return {
          success: true,
          image_b64: base64_data,
          image_mime_type: mime_type,
          raw_response: response_data,
        };
      }
      
      // If no image found, return text response
      return {
        success: true,
        text: content,
        raw_response: response_data,
      };
    }
    
    // If content is an array (multimodal), look for image_url
    if (Array.isArray(content)) {
      const content_array = content as Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
      for (const item of content_array) {
        if (item.type === 'image_url' && item.image_url?.url) {
          const image_url = item.image_url.url;
          // Handle data URLs
          if (image_url.startsWith('data:')) {
            const base64_match = image_url.match(/data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/);
            if (base64_match) {
              const mime_type = `image/${base64_match[1]}`;
              const base64_data = base64_match[2];
              return {
                success: true,
                image_b64: base64_data,
                image_mime_type: mime_type,
                raw_response: response_data,
              };
            }
          } else {
            // Fetch from URL
            try {
              const image_response = await fetch(image_url);
              if (!image_response.ok) {
                return {
                  success: false,
                  error: `Failed to fetch edited image: HTTP ${image_response.status}`,
                };
              }
              const image_array_buffer = await image_response.arrayBuffer();
              const uint8_array = new Uint8Array(image_array_buffer);
              const chunk_size = 8192;
              let binary_string = '';
              
              for (let i = 0; i < uint8_array.length; i += chunk_size) {
                const chunk = uint8_array.slice(i, i + chunk_size);
                binary_string += String.fromCharCode(...chunk);
              }
              
              const image_base64 = btoa(binary_string);
              const content_type = image_response.headers.get('content-type') || 'image/png';
              
              return {
                success: true,
                image_b64: image_base64,
                image_mime_type: content_type,
                raw_response: response_data,
              };
            } catch (fetch_error) {
              logger.error('Failed to fetch image from URL', {
                file: file_name,
                line: 950,
                data: { error: fetch_error instanceof Error ? fetch_error.message : String(fetch_error), url: image_url },
              });
              return {
                success: false,
                error: 'Failed to fetch image from URL in response',
                raw_response: response_data,
              };
            }
          }
        }
      }
    }
    
    // If we get here, no image was found
    logger.warn('No image found in DashScope image editing response', {
      file: file_name,
      line: 960,
      data: { raw_response: response_data },
    });
    
    return {
      success: false,
      error: 'No image found in response',
      raw_response: response_data,
    };
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to call DashScope image editing API', {
      file: file_name,
      line: 970,
      data: { error: error_message, model },
    });
    
    return {
      success: false,
      error: error_message,
    };
  }
}

