/**
 * Gemini Provider Implementation
 * 
 * Implements the LLMProvider interface for Google's Gemini API.
 * Handles all Gemini-specific logic including API calls, configuration, and capabilities.
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
  GeminiGenerationConfig,
} from '../../llm_api/types.js';
import { SERVICE_TYPES } from '../types.js';
import { call_gemini_api } from './gemini_client.js';
import { get_gemini_api_url } from './gemini_client.js';

// =============================================================================
// Gemini Provider Configuration
// =============================================================================

/**
 * Configuration for Gemini provider
 */
export interface GeminiProviderConfig {
  /** API key from .env.local (GEMINI_API_KEY) */
  api_key: string;
  
  /** Base API URL for text generation */
  api_url?: string;
  
  /** API URL for image generation (optional) */
  api_url_image?: string;
  
  /** Model for text_text service (e.g., gemini-2.5-flash) */
  model_text_text?: string;
  
  /** Model for image_text service */
  model_image_text?: string;
  
  /** Model for text_image service */
  model_text_image?: string;
  
  /** Model for image_image service */
  model_image_image?: string;

  /** Model for document_text service (PDF analysis) */
  model_document_text?: string;

  /** Generation config for text API calls */
  text_config?: GeminiGenerationConfig;
  
  /** Generation config for image API calls */
  image_config?: GeminiGenerationConfig;
  
  /** Capabilities this provider supports */
  capabilities?: ServiceType[];
  
  /** Logger instance */
  logger: Logger;
}

// =============================================================================
// Gemini Provider Class
// =============================================================================

/**
 * Gemini LLM Provider
 * Implements the LLMProvider interface for Google Gemini API
 */
export class GeminiProvider implements LLMProvider {
  private readonly name = 'gemini';
  private readonly api_key: string;
  private readonly api_url: string;
  private readonly api_url_image: string | undefined;
  private readonly model_text_text: string | undefined;
  private readonly model_image_text: string | undefined;
  private readonly model_text_image: string | undefined;
  private readonly model_image_image: string | undefined;
  private readonly model_document_text: string | undefined;
  private readonly text_config: GeminiGenerationConfig | undefined;
  private readonly image_config: GeminiGenerationConfig | undefined;
  private readonly capabilities: LLMCapabilities;
  private readonly logger: Logger;
  
  /**
   * Create a new Gemini provider instance
   * @param config - Gemini provider configuration
   */
  constructor(config: GeminiProviderConfig) {
    this.api_key = config.api_key;
    this.api_url = config.api_url || get_gemini_api_url();
    this.api_url_image = config.api_url_image;
    this.model_text_text = config.model_text_text;
    this.model_image_text = config.model_image_text;
    this.model_text_image = config.model_text_image;
    this.model_image_image = config.model_image_image;
    this.model_document_text = config.model_document_text;
    this.text_config = config.text_config;
    this.image_config = config.image_config;
    this.logger = config.logger;
    
    // Set capabilities - default to all if not specified
    if (config.capabilities && config.capabilities.length > 0) {
      this.capabilities = new Set(config.capabilities);
    } else {
      // Default: support all services
      this.capabilities = new Set([
        SERVICE_TYPES.TEXT_TEXT,
        SERVICE_TYPES.IMAGE_TEXT,
        SERVICE_TYPES.TEXT_IMAGE,
        SERVICE_TYPES.IMAGE_IMAGE,
        SERVICE_TYPES.DOCUMENT_TEXT,
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
        return this.model_document_text;
      default:
        return undefined;
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
    const file_name = 'gemini_provider.ts';
    
    // Use the prompt directly (variable substitution should be done by service layer)
    const prompt_text = params.prompt;
    
    // Use per-service model if configured, otherwise use default api_url
    const model = this.model_text_text;
    const api_url = model ? get_gemini_api_url(model) : this.api_url;
    
    logger.debug('Gemini provider: text_text', {
      file: file_name,
      line: 171,
      data: {
        prompt_length: prompt_text.length,
        has_variables: !!params.prompt_variables,
        model: model || 'default (from api_url)',
        api_url,
      },
    });
    
    return await call_gemini_api(
      api_url,
      this.api_key,
      prompt_text,
      undefined, // No image data
      logger,
      this.text_config
    );
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
    const file_name = 'gemini_provider.ts';

    // Log received params for debugging
    const received_b64_length = params.image_b64?.length || 0;
    logger.info(`[GEMINI_PROVIDER] image_text received params`, {
      file: file_name,
      data: {
        prompt_length: params.prompt?.length || 0,
        image_b64_length: received_b64_length,
        image_mime_type: params.image_mime_type,
        has_image: !!params.image_b64,
      },
    });

    if (!params.image_b64 || !params.image_mime_type) {
      return {
        success: false,
        error: 'image_b64 and image_mime_type are required',
      };
    }

    const image_data: Base64Data[] = [{
      mime_type: params.image_mime_type,
      data: params.image_b64,
    }];
    
    // Use per-service model if configured, otherwise use default api_url
    const model = this.model_image_text;
    const api_url = model ? get_gemini_api_url(model) : this.api_url;
    
    logger.debug('Gemini provider: image_text', {
      file: file_name,
      line: 213,
      data: {
        prompt_length: params.prompt.length,
        image_mime_type: params.image_mime_type,
        model: model || 'default (from api_url)',
        api_url,
      },
    });
    
    return await call_gemini_api(
      api_url,
      this.api_key,
      params.prompt,
      image_data,
      logger,
      this.image_config
    );
  }
  
  /**
   * Text input → Image output
   * Generate an image from a text prompt
   * 
   * @param params - Text input parameters for image generation
   * @param logger - Logger instance
   * @returns LLM response with generated image
   */
  async text_image(params: TextImageParams, logger: Logger): Promise<LLMResponse> {
    const file_name = 'gemini_provider.ts';
    
    // Use per-service model if configured, otherwise use api_url_image or api_url
    const model = this.model_text_image;
    let api_url: string;
    if (model) {
      api_url = get_gemini_api_url(model);
    } else {
      api_url = this.api_url_image || this.api_url;
    }
    
    logger.debug('Gemini provider: text_image', {
      file: file_name,
      line: 256,
      data: {
        prompt_length: params.prompt.length,
        model: model || 'default (from api_url_image/api_url)',
        api_url,
      },
    });
    
    try {
      const url = `${api_url}?key=${this.api_key}`;
      
      // Build generation config with required responseModalities for image generation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gen_config: Record<string, any> = {
        responseModalities: ['TEXT', 'IMAGE'],
      };
      
      // Merge in any custom config
      if (this.image_config) {
        if (this.image_config.temperature !== undefined) {
          gen_config.temperature = this.image_config.temperature;
        }
        if (this.image_config.max_output_tokens !== undefined) {
          gen_config.maxOutputTokens = this.image_config.max_output_tokens;
        }
        if (this.image_config.top_p !== undefined) {
          gen_config.topP = this.image_config.top_p;
        }
        if (this.image_config.top_k !== undefined) {
          gen_config.topK = this.image_config.top_k;
        }
        if (this.image_config.candidate_count !== undefined) {
          gen_config.candidateCount = this.image_config.candidate_count;
        }
        if (this.image_config.stop_sequences !== undefined && this.image_config.stop_sequences.length > 0) {
          gen_config.stopSequences = this.image_config.stop_sequences;
        }
        if (this.image_config.response_mime_type !== undefined) {
          gen_config.responseMimeType = this.image_config.response_mime_type;
        }
      }
      
      const request_body = {
        contents: [
          {
            parts: [{ text: params.prompt }],
          },
        ],
        generationConfig: gen_config,
      };
      
      logger.debug('Calling Gemini image generation API', {
        file: file_name,
        line: 220,
        data: {
          api_url,
          prompt: params.prompt,
          generation_config: gen_config,
        },
      });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request_body),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        const error_msg = data?.error?.message || `API error: ${response.status}`;
        logger.error('Gemini image generation failed', {
          file: file_name,
          line: 238,
          data: { status: response.status, error: error_msg, generation_config: gen_config },
        });
        return { success: false, error: error_msg };
      }
      
      // Extract image and text from response
      const candidates = data.candidates;
      if (!candidates || candidates.length === 0) {
        return { success: false, error: 'No content generated' };
      }
      
      const parts = candidates[0]?.content?.parts || [];
      let image_b64: string | undefined;
      let image_mime_type: string | undefined;
      let text: string | undefined;
      
      for (const part of parts) {
        if (part.inlineData) {
          image_b64 = part.inlineData.data;
          image_mime_type = part.inlineData.mimeType || 'image/png';
        }
        if (part.text) {
          text = part.text;
        }
      }
      
      return {
        success: true,
        text,
        image_b64,
        image_mime_type,
        raw_response: data,
      };
      
    } catch (error) {
      const error_message = error instanceof Error ? error.message : String(error);
      logger.error('Error calling Gemini image generation', {
        file: file_name,
        line: 270,
        data: { error: error_message },
      });
      return { success: false, error: error_message };
    }
  }
  
  /**
   * Image input → Image output
   * Transform/edit an image based on instructions
   * 
   * @param params - Image input parameters with transformation instructions
   * @param logger - Logger instance
   * @returns LLM response with transformed image
   */
  async image_image(params: ImageImageParams, logger: Logger): Promise<LLMResponse> {
    const file_name = 'gemini_provider.ts';
    
    // Collect images
    const images: Base64Data[] = [];
    
    if (params.images && params.images.length > 0) {
      images.push(...params.images);
    } else if (params.image_b64 && params.image_mime_type) {
      images.push({
        data: params.image_b64,
        mime_type: params.image_mime_type,
      });
    }
    
    if (images.length === 0) {
      return {
        success: false,
        error: 'At least one image is required',
      };
    }
    
    // Use per-service model if configured, otherwise use api_url_image or api_url
    const model = this.model_image_image;
    let api_url: string;
    if (model) {
      api_url = get_gemini_api_url(model);
    } else {
      api_url = this.api_url_image || this.api_url;
    }
    
    logger.debug('Gemini provider: image_image', {
      file: file_name,
      line: 407,
      data: {
        prompt_length: params.prompt.length,
        image_count: images.length,
        model: model || 'default (from api_url_image/api_url)',
        api_url,
      },
    });
    
    try {
      const url = `${api_url}?key=${this.api_key}`;
      
      // Build parts array with all images followed by the text prompt
      const parts: Array<{ inlineData: { mimeType: string; data: string } } | { text: string }> = [];
      
      // Add all images
      for (const image of images) {
        parts.push({
          inlineData: {
            mimeType: image.mime_type,
            data: image.data,
          },
        });
      }
      
      // Add the text prompt
      parts.push({ text: params.prompt });
      
      // Build generation config with required responseModalities
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gen_config: Record<string, any> = {
        responseModalities: ['TEXT', 'IMAGE'],
      };
      
      // Merge in any custom config
      if (this.image_config) {
        if (this.image_config.temperature !== undefined) {
          gen_config.temperature = this.image_config.temperature;
        }
        if (this.image_config.max_output_tokens !== undefined) {
          gen_config.maxOutputTokens = this.image_config.max_output_tokens;
        }
        if (this.image_config.top_p !== undefined) {
          gen_config.topP = this.image_config.top_p;
        }
        if (this.image_config.top_k !== undefined) {
          gen_config.topK = this.image_config.top_k;
        }
        if (this.image_config.candidate_count !== undefined) {
          gen_config.candidateCount = this.image_config.candidate_count;
        }
        if (this.image_config.stop_sequences !== undefined && this.image_config.stop_sequences.length > 0) {
          gen_config.stopSequences = this.image_config.stop_sequences;
        }
        if (this.image_config.response_mime_type !== undefined) {
          gen_config.responseMimeType = this.image_config.response_mime_type;
        }
      }
      
      const request_body = {
        contents: [
          {
            parts: parts,
          },
        ],
        generationConfig: gen_config,
      };
      
      logger.debug('Calling Gemini image transformation API', {
        file: file_name,
        line: 375,
        data: {
          api_url,
          prompt: params.prompt,
          image_count: images.length,
          generation_config: gen_config,
        },
      });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request_body),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        const error_msg = data?.error?.message || `API error: ${response.status}`;
        logger.error('Gemini image transformation failed', {
          file: file_name,
          line: 393,
          data: { status: response.status, error: error_msg, generation_config: gen_config },
        });
        return { success: false, error: error_msg };
      }
      
      // Extract image and text from response
      const candidates = data.candidates;
      if (!candidates || candidates.length === 0) {
        return { success: false, error: 'No content generated' };
      }
      
      const response_parts = candidates[0]?.content?.parts || [];
      let image_b64: string | undefined;
      let image_mime_type: string | undefined;
      let text: string | undefined;
      
      for (const part of response_parts) {
        if (part.inlineData) {
          image_b64 = part.inlineData.data;
          image_mime_type = part.inlineData.mimeType || 'image/png';
        }
        if (part.text) {
          text = part.text;
        }
      }
      
      return {
        success: true,
        text,
        image_b64,
        image_mime_type,
        raw_response: data,
      };
      
    } catch (error) {
      const error_message = error instanceof Error ? error.message : String(error);
      logger.error('Error calling Gemini image transformation', {
        file: file_name,
        line: 428,
        data: { error: error_message },
      });
      return { success: false, error: error_message };
    }
  }

  /**
   * Document input → Text output
   * Analyze a document (PDF) and generate text description
   *
   * Gemini supports PDF natively via the same multimodal format as images.
   * PDFs are passed as inline_data with application/pdf MIME type.
   *
   * @param params - Document input parameters
   * @param logger - Logger instance
   * @returns LLM response with generated text
   */
  async document_text(params: DocumentTextParams, logger: Logger): Promise<LLMResponse> {
    const file_name = 'gemini_provider.ts';

    if (!params.document_b64 || !params.document_mime_type) {
      return {
        success: false,
        error: 'document_b64 and document_mime_type are required',
      };
    }

    // Gemini supports PDF natively with the same format as images
    const document_data: Base64Data[] = [{
      mime_type: params.document_mime_type,
      data: params.document_b64,
    }];

    // Use per-service model if configured, otherwise fall back to image_text model or default
    const model = this.model_document_text || this.model_image_text;
    const api_url = model ? get_gemini_api_url(model) : this.api_url;

    logger.debug('Gemini provider: document_text', {
      file: file_name,
      data: {
        prompt_length: params.prompt.length,
        document_mime_type: params.document_mime_type,
        max_pages: params.max_pages,
        model: model || 'default (from api_url)',
        api_url,
      },
    });

    // Use the same call_gemini_api function - Gemini handles PDFs as multimodal input
    return await call_gemini_api(
      api_url,
      this.api_key,
      params.prompt,
      document_data,
      logger,
      this.image_config  // Use same config as image analysis
    );
  }
}

