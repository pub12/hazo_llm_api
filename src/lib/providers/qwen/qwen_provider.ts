/**
 * Qwen Provider Implementation
 * 
 * Implements the LLMProvider interface for Alibaba Cloud DashScope Qwen API.
 * Handles all Qwen-specific logic including API calls, configuration, and capabilities.
 */

import type {
  LLMProvider,
  LLMCapabilities,
  ServiceType,
} from '../types.js';
import type {
  TextTextParams,
  ImageTextParams,
  TextImageParams,
  ImageImageParams,
  DocumentTextParams,
  LLMResponse,
  Logger,
  Base64Data,
} from '../../llm_api/types.js';
import { SERVICE_TYPES } from '../types.js';
import {
  call_qwen_api,
  call_qwen_image_api,
  call_qwen_image_edit_api,
  build_qwen_messages,
  get_qwen_api_url,
  get_qwen_image_api_url,
  get_qwen_image_edit_api_url,
  type QwenGenerationConfig,
} from './qwen_client.js';

// =============================================================================
// Qwen Provider Configuration
// =============================================================================

/**
 * Configuration for Qwen provider
 */
export interface QwenProviderConfig {
  /** API key from .env.local (QWEN_API_KEY) */
  api_key: string;
  
  /** Base API URL (default: DashScope endpoint) */
  api_url?: string;
  
  /** Model for text_text service (e.g., qwen-max) */
  model_text_text?: string;
  
  /** Model for image_text service (e.g., qwen-vl-max) */
  model_image_text?: string;
  
  /** Model for text_image service (e.g., qwen-vl-max) */
  model_text_image?: string;
  
  /** Model for image_image service (e.g., qwen-vl-max) */
  model_image_image?: string;
  
  /** API URL for text_text service (optional, uses api_url if not specified) */
  api_url_text_text?: string;
  
  /** API URL for image_text service (optional, uses api_url if not specified) */
  api_url_image_text?: string;
  
  /** API URL for text_image service (optional, uses api_url if not specified) */
  api_url_text_image?: string;
  
  /** API URL for image_image service (optional, uses api_url if not specified) */
  api_url_image_image?: string;
  
  /** Default system instruction */
  system_instruction?: string;
  
  /** Generation config for text API calls */
  text_config?: QwenGenerationConfig;
  
  /** Generation config for image API calls */
  image_config?: QwenGenerationConfig;
  
  /** Capabilities this provider supports */
  capabilities?: ServiceType[];
  
  /** Logger instance */
  logger: Logger;
}

// =============================================================================
// Qwen Provider Class
// =============================================================================

/**
 * Qwen LLM Provider
 * Implements the LLMProvider interface for Alibaba Cloud DashScope Qwen API
 */
export class QwenProvider implements LLMProvider {
  private readonly name = 'qwen';
  private readonly api_key: string;
  private readonly api_url: string;
  private readonly model_text_text: string | undefined;
  private readonly model_image_text: string | undefined;
  private readonly model_text_image: string | undefined;
  private readonly model_image_image: string | undefined;
  private readonly api_url_text_text: string | undefined;
  private readonly api_url_image_text: string | undefined;
  private readonly api_url_text_image: string | undefined;
  private readonly api_url_image_image: string | undefined;
  private readonly system_instruction: string | undefined;
  private readonly text_config: QwenGenerationConfig | undefined;
  private readonly image_config: QwenGenerationConfig | undefined;
  private readonly capabilities: LLMCapabilities;
  private readonly logger: Logger;
  
  /**
   * Create a new Qwen provider instance
   * @param config - Qwen provider configuration
   */
  constructor(config: QwenProviderConfig) {
    this.api_key = config.api_key;
    this.api_url = config.api_url || get_qwen_api_url();
    this.model_text_text = config.model_text_text;
    this.model_image_text = config.model_image_text;
    this.model_text_image = config.model_text_image;
    this.model_image_image = config.model_image_image;
    this.api_url_text_text = config.api_url_text_text;
    this.api_url_image_text = config.api_url_image_text;
    this.api_url_text_image = config.api_url_text_image;
    this.api_url_image_image = config.api_url_image_image;
    this.system_instruction = config.system_instruction;
    this.text_config = config.text_config;
    this.image_config = config.image_config;
    this.logger = config.logger;
    
    // Set capabilities - default to text services if not specified
    if (config.capabilities && config.capabilities.length > 0) {
      this.capabilities = new Set(config.capabilities);
    } else {
      // Default: support text services (image generation/transformation may not be supported by all Qwen models)
      this.capabilities = new Set([
        SERVICE_TYPES.TEXT_TEXT,
        SERVICE_TYPES.IMAGE_TEXT,
      ]);
    }
  }
  
  /**
   * Get the provider name
   * @returns Provider name
   */
  get_name(): string {
    return this.name;
  }
  
  /**
   * Get the capabilities this provider supports
   * @returns Set of supported service types
   */
  get_capabilities(): LLMCapabilities {
    return new Set(this.capabilities); // Return a copy
  }
  
  /**
   * Get the model name configured for a specific service type
   * @param service_type - The service type to get the model for
   * @returns Model name or undefined if not configured
   */
  get_model_for_service(service_type: ServiceType): string | undefined {
    switch (service_type) {
      case SERVICE_TYPES.TEXT_TEXT:
        return this.model_text_text;
      case SERVICE_TYPES.IMAGE_TEXT:
        return this.model_image_text;
      case SERVICE_TYPES.TEXT_IMAGE:
        return this.model_text_image;
      case SERVICE_TYPES.IMAGE_IMAGE:
        return this.model_image_image;
      case SERVICE_TYPES.DOCUMENT_TEXT:
        return undefined;  // Document text not supported via base64 in Qwen
      default:
        return undefined;
    }
  }
  
  /**
   * Get the model for a service or throw error
   * @param service_type - Service type
   * @returns Model name
   * @throws Error if model not configured
   */
  private get_required_model(service_type: ServiceType): string {
    const model = this.get_model_for_service(service_type);
    if (!model) {
      // Map service type to config key name for helpful error message
      const config_key_map: Record<ServiceType, string> = {
        [SERVICE_TYPES.TEXT_TEXT]: 'model_text_text',
        [SERVICE_TYPES.IMAGE_TEXT]: 'model_image_text',
        [SERVICE_TYPES.TEXT_IMAGE]: 'model_text_image',
        [SERVICE_TYPES.IMAGE_IMAGE]: 'model_image_image',
        [SERVICE_TYPES.DOCUMENT_TEXT]: 'model_document_text',
      };
      const config_key = config_key_map[service_type] || 'model';
      throw new Error(
        `Model not configured for service: ${service_type}. ` +
        `Please set ${config_key} in the [llm_qwen] section of config/hazo_llm_api_config.ini. ` +
        `Example: ${config_key}=qwen-max`
      );
    }
    return model;
  }
  
  /**
   * Get the API URL for a specific service type
   * @param service_type - Service type
   * @returns API URL for the service, or base api_url if not specified
   */
  private get_api_url_for_service(service_type: ServiceType): string {
    switch (service_type) {
      case SERVICE_TYPES.TEXT_TEXT:
        return this.api_url_text_text || this.api_url;
      case SERVICE_TYPES.IMAGE_TEXT:
        return this.api_url_image_text || this.api_url;
      case SERVICE_TYPES.TEXT_IMAGE:
        return this.api_url_text_image || get_qwen_image_api_url();
      case SERVICE_TYPES.IMAGE_IMAGE:
        return this.api_url_image_image || this.api_url;
      default:
        return this.api_url;
    }
  }
  
  /**
   * Text input → Text output
   * Generate text from a text prompt
   * 
   * @param params - Text input parameters
   * @param logger - Logger instance
   * @returns LLM response with generated text
   */
  async text_text(params: TextTextParams, logger: Logger): Promise<LLMResponse> {
    const file_name = 'qwen_provider.ts';
    
    try {
      const model = this.get_required_model(SERVICE_TYPES.TEXT_TEXT);
      const messages = build_qwen_messages(
        params.prompt,
        this.system_instruction
      );
      
      logger.debug('Qwen provider: text_text', {
        file: file_name,
        line: 158,
        data: {
          model,
          prompt_length: params.prompt.length,
        },
      });
      
      const api_url = this.get_api_url_for_service(SERVICE_TYPES.TEXT_TEXT);
      return await call_qwen_api(
        api_url,
        this.api_key,
        model,
        messages,
        logger,
        this.text_config
      );
    } catch (error) {
      const error_message = error instanceof Error ? error.message : String(error);
      logger.error('Error in Qwen text_text', {
        file: file_name,
        line: 173,
        data: { error: error_message },
      });
      return { success: false, error: error_message };
    }
  }
  
  /**
   * Image input → Text output
   * Analyze an image and generate text description
   * 
   * @param params - Image input parameters
   * @param logger - Logger instance
   * @returns LLM response with generated text
   */
  async image_text(params: ImageTextParams, logger: Logger): Promise<LLMResponse> {
    const file_name = 'qwen_provider.ts';
    
    try {
      if (!params.image_b64 || !params.image_mime_type) {
        return {
          success: false,
          error: 'image_b64 and image_mime_type are required',
        };
      }
      
      const model = this.get_required_model(SERVICE_TYPES.IMAGE_TEXT);
      const image_data: Base64Data[] = [{
        mime_type: params.image_mime_type,
        data: params.image_b64,
      }];
      
      const messages = build_qwen_messages(
        params.prompt,
        this.system_instruction,
        image_data
      );
      
      logger.debug('Qwen provider: image_text', {
        file: file_name,
        line: 208,
        data: {
          model,
          prompt_length: params.prompt.length,
          image_mime_type: params.image_mime_type,
        },
      });
      
      const api_url = this.get_api_url_for_service(SERVICE_TYPES.IMAGE_TEXT);
      return await call_qwen_api(
        api_url,
        this.api_key,
        model,
        messages,
        logger,
        this.image_config
      );
    } catch (error) {
      const error_message = error instanceof Error ? error.message : String(error);
      logger.error('Error in Qwen image_text', {
        file: file_name,
        line: 225,
        data: { error: error_message },
      });
      return { success: false, error: error_message };
    }
  }
  
  /**
   * Text input → Image output
   * Generate an image from a text prompt
   * Uses DashScope image generation API
   * 
   * @param params - Text input parameters for image generation
   * @param logger - Logger instance
   * @returns LLM response with generated image
   */
  async text_image(params: TextImageParams, logger: Logger): Promise<LLMResponse> {
    const file_name = 'qwen_provider.ts';
    
    try {
      const model = this.get_required_model(SERVICE_TYPES.TEXT_IMAGE);
      const api_url = this.get_api_url_for_service(SERVICE_TYPES.TEXT_IMAGE);
      
      logger.debug('Qwen provider: text_image', {
        file: file_name,
        line: 300,
        data: {
          model,
          api_url,
          prompt_length: params.prompt.length,
        },
      });
      
      return await call_qwen_image_api(
        api_url,
        this.api_key,
        model,
        params.prompt,
        logger,
        this.image_config
      );
    } catch (error) {
      const error_message = error instanceof Error ? error.message : String(error);
      logger.error('Error in Qwen text_image', {
        file: file_name,
        line: 320,
        data: { error: error_message },
      });
      return { success: false, error: error_message };
    }
  }
  
  /**
   * Image input → Image output
   * Transform/edit an image based on instructions
   * Uses DashScope image editing API
   * 
   * @param params - Image input parameters with transformation instructions
   * @param logger - Logger instance
   * @returns LLM response with transformed image
   */
  async image_image(params: ImageImageParams, logger: Logger): Promise<LLMResponse> {
    const file_name = 'qwen_provider.ts';
    
    try {
      // Collect input images (support multiple images, up to 3 for Qwen)
      const input_images: Base64Data[] = [];
      
      if (params.images && params.images.length > 0) {
        // Use all images (Qwen supports 1-3 images)
        if (params.images.length > 3) {
          logger.warn('Qwen image editing supports up to 3 images, using first 3', {
            file: file_name,
            line: 397,
            data: { provided_count: params.images.length },
          });
          input_images.push(...params.images.slice(0, 3));
        } else {
          input_images.push(...params.images);
        }
      } else if (params.image_b64 && params.image_mime_type) {
        input_images.push({
          data: params.image_b64,
          mime_type: params.image_mime_type,
        });
      }
      
      if (input_images.length === 0) {
        return {
          success: false,
          error: 'At least one image is required',
        };
      }
      
      const model = this.get_required_model(SERVICE_TYPES.IMAGE_IMAGE);
      const api_url = this.get_api_url_for_service(SERVICE_TYPES.IMAGE_IMAGE);
      
      logger.debug('Qwen provider: image_image', {
        file: file_name,
        line: 345,
        data: {
          model,
          api_url,
          prompt_length: params.prompt.length,
          image_count: input_images.length,
          image_mime_types: input_images.map(img => img.mime_type),
        },
      });
      
      return await call_qwen_image_edit_api(
        api_url,
        this.api_key,
        model,
        params.prompt,
        input_images,
        logger,
        this.image_config
      );
    } catch (error) {
      const error_message = error instanceof Error ? error.message : String(error);
      logger.error('Error in Qwen image_image', {
        file: file_name,
        line: 375,
        data: { error: error_message },
      });
      return { success: false, error: error_message };
    }
  }

  /**
   * Document input → Text output
   * Analyze a document (PDF) and generate text description
   *
   * NOTE: Qwen-Doc-Turbo requires document URL (not base64 data).
   * This is a limitation for v1 - returns informative error directing users to Gemini.
   * Future enhancement: Convert PDF pages to images and use Qwen-VL.
   *
   * @param params - Document input parameters
   * @param logger - Logger instance
   * @returns LLM response with error (Qwen requires URL-based document access)
   */
  async document_text(params: DocumentTextParams, logger: Logger): Promise<LLMResponse> {
    const file_name = 'qwen_provider.ts';

    logger.warn('Qwen document_text: PDF analysis with base64 data not supported', {
      file: file_name,
      data: {
        document_mime_type: params.document_mime_type,
        prompt_length: params.prompt.length,
      },
    });

    // Qwen-Doc-Turbo requires document URL, not base64 data
    // For v1, return informative error directing users to Gemini
    return {
      success: false,
      error: 'Qwen document analysis requires a publicly accessible document URL (doc_url parameter). ' +
        'Base64 document data is not supported by Qwen-Doc-Turbo. ' +
        'Please use Gemini provider for base64 PDF analysis, or provide a document URL.',
    };
  }
}

