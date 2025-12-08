/**
 * hazo_llm_text_image_text Function
 * 
 * Text → Image → Text (Chained)
 * 1. Generate an image from prompt_image using hazo_llm_text_image
 * 2. Analyze the generated image with prompt_text using hazo_llm_image_text
 * 3. Return both the generated image and the analysis text
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import type {
  TextImageTextParams,
  LLMResponse,
  LLMApiConfig,
} from './types.js';
import { hazo_llm_text_image } from './hazo_llm_text_image.js';
import { hazo_llm_image_text } from './hazo_llm_image_text.js';

// =============================================================================
// hazo_llm_text_image_text Function
// =============================================================================

/**
 * Generate an image from text, then analyze it with a second prompt
 * 
 * Flow:
 * 1. Call hazo_llm_text_image with prompt_image to generate an image
 * 2. Call hazo_llm_image_text with the generated image and prompt_text
 * 3. Return the generated image and the text analysis from step 2
 * 
 * @param params - Parameters with two prompts: one for image gen, one for analysis
 * @param db - Database instance
 * @param config - LLM API configuration
 * @param llm - Optional LLM provider name (uses primary LLM if not specified)
 * @returns LLM response with generated image and analysis text
 */
export async function hazo_llm_text_image_text(
  params: TextImageTextParams,
  db: SqlJsDatabase | null,
  config: LLMApiConfig,
  llm?: string
): Promise<LLMResponse> {
  const file_name = 'hazo_llm_text_image_text.ts';
  const logger = config.logger;
  
  const api_name = 'text_image_text';
  
  try {
    // ==========================================================================
    // Log API call start
    // ==========================================================================
    logger.debug(`########################################################################### ${api_name}`, {
      file: file_name,
      line: 48,
    });
    
    // Log API call details with generation configs
    logger.debug('API call details', {
      file: file_name,
      line: 53,
      data: {
        chain_steps: ['text_image', 'image_text'],
        prompt_image: params.prompt_image,
        prompt_text: params.prompt_text,
        prompt_image_variables: params.prompt_image_variables,
        prompt_text_variables: params.prompt_text_variables,
        llm_requested: llm || 'primary',
      },
    });
    
    // ==========================================================================
    // Step 1: Generate image from prompt_image
    // ==========================================================================
    logger.debug('Chain Step 1: Image generation', {
      file: file_name,
      line: 66,
    });
    
    const image_response = await hazo_llm_text_image(
      {
        prompt: params.prompt_image,
        prompt_variables: params.prompt_image_variables,
      },
      db,
      config,
      llm
    );
    
    // Check if image generation succeeded
    if (!image_response.success) {
      logger.error('Image generation failed in text_image_text chain', {
        file: file_name,
        line: 79,
        data: { error: image_response.error },
      });
      return {
        success: false,
        error: `Image generation failed: ${image_response.error}`,
      };
    }
    
    // Check if we got an image
    if (!image_response.image_b64 || !image_response.image_mime_type) {
      logger.error('No image returned from image generation', {
        file: file_name,
        line: 90,
      });
      return {
        success: false,
        error: 'Image generation did not return an image',
        text: image_response.text, // Include any text that was returned
      };
    }
    
    // ==========================================================================
    // Step 2: Analyze the generated image with prompt_text
    // ==========================================================================
    logger.debug('Chain Step 2: Image analysis', {
      file: file_name,
      line: 103,
    });
    
    const text_response = await hazo_llm_image_text(
      {
        prompt: params.prompt_text,
        image_b64: image_response.image_b64,
        image_mime_type: image_response.image_mime_type,
        prompt_variables: params.prompt_text_variables,
      },
      db,
      config,
      llm
    );
    
    // Check if text analysis succeeded
    if (!text_response.success) {
      logger.error('Text analysis failed in text_image_text chain', {
        file: file_name,
        line: 120,
        data: { error: text_response.error },
      });
      return {
        success: false,
        error: `Image analysis failed: ${text_response.error}`,
        // Still return the generated image even if analysis failed
        image_b64: image_response.image_b64,
        image_mime_type: image_response.image_mime_type,
      };
    }
    
    // ==========================================================================
    // Log API response
    // ==========================================================================
    logger.debug('API response', {
      file: file_name,
      line: 136,
      data: {
        success: true,
        text: text_response.text,
        image_b64: '[IMAGE_DATA_PLACEHOLDER]',
        image_mime_type: image_response.image_mime_type,
      },
    });
    
    // Log API call complete
    logger.debug(`<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< ${api_name} >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`, {
      file: file_name,
      line: 147,
      data: { success: true, has_image: true },
    });
    
    return {
      success: true,
      text: text_response.text,
      image_b64: image_response.image_b64,
      image_mime_type: image_response.image_mime_type,
    };
    
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Error in hazo_llm_text_image_text', {
      file: file_name,
      line: 138,
      data: { error: error_message },
    });
    return { success: false, error: error_message };
  }
}

