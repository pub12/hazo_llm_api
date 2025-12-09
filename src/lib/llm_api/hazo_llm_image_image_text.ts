/**
 * hazo_llm_image_image_text Function
 * 
 * Images → Image → Text (Chained)
 * 
 * Flow:
 * 1. Combine images[0] + images[1] using prompts[0] → result_1
 * 2. Combine result_1 + images[2] using prompts[1] → result_2
 * 3. Continue chaining through all images
 * 4. Analyze final result with description_prompt → text output
 * 
 * Returns both the final generated image and the text description.
 */

import type { Database as SqlJsDatabase } from 'sql.js';
import type {
  ImageImageTextParams,
  LLMResponse,
  LLMApiConfig,
} from './types.js';
import { hazo_llm_image_image } from './hazo_llm_image_image.js';
import { hazo_llm_image_text } from './hazo_llm_image_text.js';

// =============================================================================
// hazo_llm_image_image_text Function
// =============================================================================

/**
 * Chain multiple image transformations, then describe the final result
 * 
 * @param params - Parameters with images, prompts, and description prompt
 * @param db - Database instance
 * @param config - LLM API configuration
 * @param llm - Optional LLM provider name (uses primary LLM if not specified)
 * @returns LLM response with final image and description text
 */
export async function hazo_llm_image_image_text(
  params: ImageImageTextParams,
  db: SqlJsDatabase | null,
  config: LLMApiConfig,
  llm?: string
): Promise<LLMResponse> {
  const file_name = 'hazo_llm_image_image_text.ts';
  // Use default logger if not provided
  const { default_logger } = await import('./index.js');
  const logger = config.logger || default_logger;

  const api_name = 'image_image_text';
  
  try {
    // ==========================================================================
    // Log API call start
    // ==========================================================================
    logger.debug(`########################################################################### ${api_name}`, {
      file: file_name,
      line: 48,
    });
    
    // ==========================================================================
    // Validate input
    // ==========================================================================
    if (!params.images || params.images.length < 2) {
      const error_msg = 'At least two images are required';
      logger.error(error_msg, { file: file_name, line: 58 });
      return { success: false, error: error_msg };
    }
    
    const expected_prompts = params.images.length - 1;
    if (!params.prompts || params.prompts.length !== expected_prompts) {
      const error_msg = `Expected ${expected_prompts} prompts for ${params.images.length} images, got ${params.prompts?.length || 0}`;
      logger.error(error_msg, { file: file_name, line: 65 });
      return { success: false, error: error_msg };
    }
    
    if (!params.description_prompt?.trim()) {
      const error_msg = 'Description prompt is required';
      logger.error(error_msg, { file: file_name, line: 71 });
      return { success: false, error: error_msg };
    }
    
    // Log API call details with generation configs
    logger.debug('API call details', {
      file: file_name,
      line: 77,
      data: {
        chain_steps: Array.from({ length: params.images.length }, (_, i) => i < params.images.length - 1 ? 'image_image' : 'image_text'),
        image_count: params.images.length,
        prompts: params.prompts,
        description_prompt: params.description_prompt,
        image_data: params.images.map(img => ({
          mime_type: img.image_mime_type,
          data: '[IMAGE_DATA_PLACEHOLDER]',
        })),
        llm_requested: llm || 'primary',
      },
    });
    
    // ==========================================================================
    // Step 1: Combine first two images
    // ==========================================================================
    logger.debug('Chain Step 1: Combining first two images', {
      file: file_name,
      line: 94,
    });
    
    let current_result = await hazo_llm_image_image(
      {
        prompt: params.prompts[0],
        images: [
          { data: params.images[0].image_b64, mime_type: params.images[0].image_mime_type },
          { data: params.images[1].image_b64, mime_type: params.images[1].image_mime_type },
        ],
      },
      db,
      config,
      llm
    );
    
    if (!current_result.success) {
      logger.error('Step 1 failed: combining first two images', {
        file: file_name,
        line: 111,
        data: { error: current_result.error },
      });
      return {
        success: false,
        error: `Step 1 failed: ${current_result.error}`,
      };
    }
    
    if (!current_result.image_b64 || !current_result.image_mime_type) {
      logger.error('Step 1 did not return an image', {
        file: file_name,
        line: 122,
      });
      return {
        success: false,
        error: 'Step 1 did not return an image',
        text: current_result.text,
      };
    }
    
    // ==========================================================================
    // Steps 2+: Chain through remaining images
    // ==========================================================================
    for (let i = 2; i < params.images.length; i++) {
      const step_num = i;
      const prompt_index = i - 1;
      
      logger.debug(`Chain Step ${step_num}: Adding image ${i + 1}`, {
        file: file_name,
        line: 139,
      });
      
      // Combine current result with next image
      current_result = await hazo_llm_image_image(
        {
          prompt: params.prompts[prompt_index],
          images: [
            { data: current_result.image_b64!, mime_type: current_result.image_mime_type! },
            { data: params.images[i].image_b64, mime_type: params.images[i].image_mime_type },
          ],
        },
        db,
        config,
        llm
      );
      
      if (!current_result.success) {
        logger.error(`Step ${step_num} failed`, {
          file: file_name,
          line: 157,
          data: { step: step_num, error: current_result.error },
        });
        return {
          success: false,
          error: `Step ${step_num} failed: ${current_result.error}`,
        };
      }
      
      if (!current_result.image_b64 || !current_result.image_mime_type) {
        logger.error(`Step ${step_num} did not return an image`, {
          file: file_name,
          line: 168,
          data: { step: step_num },
        });
        return {
          success: false,
          error: `Step ${step_num} did not return an image`,
          text: current_result.text,
        };
      }
    }
    
    // ==========================================================================
    // Final Step: Describe the final image
    // ==========================================================================
    logger.debug('Chain Final Step: Generating description', {
      file: file_name,
      line: 183,
    });
    
    const text_response = await hazo_llm_image_text(
      {
        prompt: params.description_prompt,
        image_b64: current_result.image_b64!,
        image_mime_type: current_result.image_mime_type!,
        prompt_variables: params.description_prompt_variables,
      },
      db,
      config,
      llm
    );
    
    if (!text_response.success) {
      logger.error('Description generation failed', {
        file: file_name,
        line: 199,
        data: { error: text_response.error },
      });
      return {
        success: false,
        error: `Description failed: ${text_response.error}`,
        // Still return the final image even if description failed
        image_b64: current_result.image_b64,
        image_mime_type: current_result.image_mime_type,
      };
    }
    
    // ==========================================================================
    // Log API response
    // ==========================================================================
    logger.debug('API response', {
      file: file_name,
      line: 215,
      data: {
        success: true,
        text: text_response.text,
        image_b64: '[IMAGE_DATA_PLACEHOLDER]',
        image_mime_type: current_result.image_mime_type,
      },
    });
    
    // Log API call complete
    logger.debug(`<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< ${api_name} >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`, {
      file: file_name,
      line: 226,
      data: {
        success: true,
        total_steps: params.images.length,
        has_image: true,
      },
    });
    
    return {
      success: true,
      text: text_response.text,
      image_b64: current_result.image_b64,
      image_mime_type: current_result.image_mime_type,
    };
    
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    logger.error('Error in hazo_llm_image_image_text', {
      file: file_name,
      line: 231,
      data: { error: error_message },
    });
    return { success: false, error: error_message };
  }
}
