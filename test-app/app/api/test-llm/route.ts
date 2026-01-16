/**
 * Test LLM API Route
 * 
 * API route to test the LLM API functionality from server-side.
 * Provides endpoints for testing static prompts, dynamic prompts,
 * variable substitution, and error handling.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  initialize_llm_api,
  hazo_llm_text_text,
  hazo_llm_image_text,
  hazo_llm_text_image,
  hazo_llm_image_image,
  hazo_llm_document_text,
  hazo_llm_text_image_text,
  hazo_llm_image_image_text,
  hazo_llm_prompt_chain,
  insert_prompt,
  get_database,
  is_initialized,
} from 'hazo_llm_api/server';
import type { Logger, TextTextParams, ImageTextParams, TextImageParams, ImageImageParams, DocumentTextParams, TextImageTextParams, ImageImageTextParams, ChainImage, PromptChainParams } from 'hazo_llm_api/server';
import * as fs from 'fs';
import * as path from 'path';
import * as ini from 'ini';

// =============================================================================
// Config Reader
// =============================================================================

interface AppConfig {
  api_url: string;
  api_url_image: string;
  sqlite_path: string;
}

/**
 * Read configuration from hazo_llm_api_config.ini file
 * Returns Gemini API URLs and SQLite database path
 */
function get_app_config(): AppConfig {
  const config_path = path.resolve(process.cwd(), '..', 'config', 'hazo_llm_api_config.ini');
  
  try {
    const config_content = fs.readFileSync(config_path, 'utf-8');
    const config = ini.parse(config_content);
    
    return {
      api_url: config.gemini?.api_url || 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent',
      api_url_image: config.gemini?.api_url_image || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
      sqlite_path: config.llm?.sqlite_path || 'prompt_library.sqlite',
    };
  } catch (error) {
    console.error('Failed to read config file, using defaults:', error);
    return {
      api_url: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent',
      api_url_image: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
      sqlite_path: 'prompt_library.sqlite',
    };
  }
}

// =============================================================================
// Simple Console Logger (for testing)
// =============================================================================

const test_logger: Logger = {
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(`[ERROR] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  },
  debug: (message: string, meta?: Record<string, unknown>) => {
    console.debug(`[DEBUG] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  },
};

// =============================================================================
// Initialize LLM API (if not already initialized)
// =============================================================================

async function ensure_initialized(): Promise<boolean> {
  if (!is_initialized()) {
    const api_key = process.env.GEMINI_API_KEY;
    
    if (!api_key) {
      return false;
    }
    
    // Read config from config file (API URLs and sqlite_path)
    const app_config = get_app_config();
    
    try {
      await initialize_llm_api({
        logger: test_logger,
        sqlite_path: app_config.sqlite_path,
      });
    } catch (error) {
      test_logger.error('Failed to initialize LLM API', {
        file: 'route.ts',
        line: 60,
        data: { error: error instanceof Error ? error.message : String(error) },
      });
      return false;
    }
  }
  
  return true;
}

// =============================================================================
// Test Types
// =============================================================================

interface TestResult {
  test_name: string;
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

// =============================================================================
// POST Handler - Run Tests
// =============================================================================

export async function POST(request: NextRequest) {
  const file_name = 'route.ts (test-llm)';
  
  try {
    const body = await request.json();
    const { test_type, llm } = body;
    
    // Check if API key is configured
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'GEMINI_API_KEY not configured in environment variables',
      }, { status: 500 });
    }
    
    // Ensure LLM API is initialized
    const init_success = await ensure_initialized();
    if (!init_success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to initialize LLM API',
      }, { status: 500 });
    }
    
    let result: TestResult;
    
    switch (test_type) {
      case 'static_prompt':
        result = await test_static_prompt(body, llm);
        break;
        
      case 'dynamic_prompt':
        result = await test_dynamic_prompt(body, llm);
        break;
        
      case 'variable_substitution':
        result = await test_variable_substitution(body, llm);
        break;
        
      case 'base64_image':
        result = await test_base64_image(body, llm);
        break;

      case 'document_text':
        result = await test_document_text(body, llm);
        break;

      case 'error_handling':
        result = await test_error_handling(body, llm);
        break;
        
      case 'insert_test_prompt':
        result = await insert_test_prompt_data(body);
        break;
        
      case 'generate_image':
        result = await test_generate_image(body, llm);
        break;
        
      case 'combine_images':
        result = await test_combine_images(body, llm);
        break;
        
      case 'text_image_text':
        result = await test_text_image_text(body, llm);
        break;
        
      case 'image_image_text':
        result = await test_image_image_text(body, llm);
        break;
        
      case 'transform_image':
        result = await test_transform_image(body, llm);
        break;

      case 'prompt_chain':
        result = await test_prompt_chain(body, llm);
        break;

      default:
        result = {
          test_name: 'unknown',
          success: false,
          message: `Unknown test type: ${test_type}`,
        };
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    test_logger.error('Test API error', {
      file: file_name,
      line: 125,
      data: { error: error_message },
    });
    
    return NextResponse.json({
      success: false,
      error: error_message,
    }, { status: 500 });
  }
}

// =============================================================================
// Test Functions
// =============================================================================

/**
 * Test 1: Text to Text
 * Call hazo_llm_text_text with a static prompt
 */
async function test_static_prompt(body: Record<string, unknown>, llm?: string): Promise<TestResult> {
  const static_prompt = (body.static_prompt as string) || 'Say "Hello from Gemini!" in a friendly tone.';
  
  const params: TextTextParams = {
    prompt: static_prompt,
  };
  
  const response = await hazo_llm_text_text(params, llm);
  
  return {
    test_name: 'Text to Text',
    success: response.success,
    message: response.success 
      ? 'Text to text test passed' 
      : `Text to text test failed: ${response.error}`,
    data: {
      prompt: static_prompt,
      response_text: response.text,
    },
    error: response.error,
  };
}

/**
 * Test 2: Dynamic Prompt Mode
 * Fetch prompt from database using prompt_area and prompt_key
 */
async function test_dynamic_prompt(body: Record<string, unknown>, llm?: string): Promise<TestResult> {
  const prompt_area = (body.prompt_area as string) || 'test';
  const prompt_key = (body.prompt_key as string) || 'greeting';
  
  const params: TextTextParams = {
    prompt: '', // Will be overridden by dynamic prompt
    prompt_area: prompt_area,
    prompt_key: prompt_key,
  };
  
  const response = await hazo_llm_text_text(params, llm);
  
  return {
    test_name: 'Dynamic Prompt Mode',
    success: response.success,
    message: response.success 
      ? 'Dynamic prompt test passed' 
      : `Dynamic prompt test failed: ${response.error}`,
    data: {
      prompt_area,
      prompt_key,
      response_text: response.text,
    },
    error: response.error,
  };
}

/**
 * Test 3: Variable Substitution
 * Test substituting variables like $location and $season in prompt text
 */
async function test_variable_substitution(body: Record<string, unknown>, llm?: string): Promise<TestResult> {
  const prompt_area = (body.prompt_area as string) || 'test';
  const prompt_key = (body.prompt_key as string) || 'weather';
  const variables = (body.variables as Record<string, string>) || {
    location: 'Tokyo',
    season: 'spring',
  };
  
  const params: TextTextParams = {
    prompt: '', // Will be overridden by dynamic prompt
    prompt_area: prompt_area,
    prompt_key: prompt_key,
    prompt_variables: [variables],
  };
  
  const response = await hazo_llm_text_text(params, llm);
  
  return {
    test_name: 'Variable Substitution',
    success: response.success,
    message: response.success 
      ? 'Variable substitution test passed' 
      : `Variable substitution test failed: ${response.error}`,
    data: {
      prompt_area,
      prompt_key,
      variables,
      response_text: response.text,
    },
    error: response.error,
  };
}

/**
 * Test 4: Image to Text (Image Analysis)
 * Send a base64 encoded image to get text description
 */
async function test_base64_image(body: Record<string, unknown>, llm?: string): Promise<TestResult> {
  const b64_data = body.b64_data as Array<{ mime_type: string; data: string }>;
  const static_prompt = (body.static_prompt as string) || 'Describe this image briefly.';
  
  if (!b64_data || b64_data.length === 0) {
    return {
      test_name: 'Image to Text',
      success: false,
      message: 'No base64 image data provided',
      error: 'b64_data is required for this test',
    };
  }
  
  const params: ImageTextParams = {
    prompt: static_prompt,
    image_b64: b64_data[0].data,
    image_mime_type: b64_data[0].mime_type,
  };
  
  const response = await hazo_llm_image_text(params, llm);
  
  return {
    test_name: 'Image to Text',
    success: response.success,
    message: response.success 
      ? 'Image to text test passed' 
      : `Image to text test failed: ${response.error}`,
    data: {
      image_count: b64_data.length,
      prompt: static_prompt,
      response_text: response.text,
    },
    error: response.error,
  };
}

/**
 * Test: Document to Text
 * Test document analysis with hazo_llm_document_text
 */
async function test_document_text(body: Record<string, unknown>, llm?: string): Promise<TestResult> {
  const document_b64 = body.document_b64 as string;
  const document_mime_type = (body.document_mime_type as string) || 'application/pdf';
  const static_prompt = (body.static_prompt as string) || 'Summarize the key points of this document.';

  if (!document_b64) {
    return {
      test_name: 'Document to Text',
      success: false,
      message: 'No document data provided',
      error: 'document_b64 is required for this test',
    };
  }

  const params: DocumentTextParams = {
    prompt: static_prompt,
    document_b64: document_b64,
    document_mime_type: document_mime_type,
  };

  const response = await hazo_llm_document_text(params, llm);

  return {
    test_name: 'Document to Text',
    success: response.success,
    message: response.success
      ? 'Document to text test passed'
      : `Document to text test failed: ${response.error}`,
    data: {
      document_mime_type,
      prompt: static_prompt,
      response_text: response.text,
    },
    error: response.error,
  };
}

/**
 * Test 5: Error Handling
 * Test with missing required fields and non-existent prompts
 */
async function test_error_handling(body: Record<string, unknown>, llm?: string): Promise<TestResult> {
  const error_type = (body.error_type as string) || 'nonexistent_prompt';
  
  let params: TextTextParams;
  let expected_error: string;
  
  switch (error_type) {
    case 'nonexistent_prompt':
      // Try to fetch a prompt that doesn't exist
      params = {
        prompt: '',
        prompt_area: 'nonexistent_area',
        prompt_key: 'nonexistent_key',
      };
      expected_error = 'Prompt not found';
      break;
      
    default:
      return {
        test_name: 'Error Handling',
        success: false,
        message: `Unknown error_type: ${error_type}`,
      };
  }
  
  const response = await hazo_llm_text_text(params, llm);
  
  // For error handling tests, we expect the call to fail
  const test_passed = !response.success && 
    (response.error?.toLowerCase().includes(expected_error.toLowerCase().split(' ')[0]) ?? false);
  
  return {
    test_name: `Error Handling (${error_type})`,
    success: test_passed,
    message: test_passed 
      ? `Error handling test passed - got expected error` 
      : `Error handling test failed - did not get expected error`,
    data: {
      error_type,
      expected_error,
      actual_error: response.error,
    },
    error: test_passed ? undefined : 'Did not get expected error',
  };
}

/**
 * Insert test prompt data into the database
 */
async function insert_test_prompt_data(body: Record<string, unknown>): Promise<TestResult> {
  const db = get_database();
  
  if (!db) {
    return {
      test_name: 'Insert Test Prompt',
      success: false,
      message: 'Database not initialized',
      error: 'Database is null',
    };
  }
  
  const prompt_area = (body.prompt_area as string) || 'test';
  const prompt_key = (body.prompt_key as string) || 'greeting';
  const local_1 = (body.local_1 as string) || null;
  const local_2 = (body.local_2 as string) || null;
  const local_3 = (body.local_3 as string) || null;
  const prompt_text = (body.prompt_text as string) || 'Say hello in a friendly way.';
  const prompt_variables = (body.prompt_variables as string) || '[]';
  const prompt_notes = (body.prompt_notes as string) || 'Test prompt for LLM API testing';

  try {
    const inserted = insert_prompt(db, {
      prompt_area,
      prompt_key,
      local_1,
      local_2,
      local_3,
      user_id: null,
      scope_id: null,
      prompt_text,
      prompt_variables,
      prompt_notes,
    }, test_logger);
    
    return {
      test_name: 'Insert Test Prompt',
      success: true,
      message: 'Test prompt inserted successfully',
      data: {
        id: inserted.id,
        prompt_area: inserted.prompt_area,
        prompt_key: inserted.prompt_key,
      },
    };
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    return {
      test_name: 'Insert Test Prompt',
      success: false,
      message: 'Failed to insert test prompt',
      error: error_message,
    };
  }
}

/**
 * Test 6: Text to Image (Image Generation)
 * Generate an image from a text prompt using hazo_llm_text_image
 */
async function test_generate_image(body: Record<string, unknown>, llm?: string): Promise<TestResult> {
  const static_prompt = (body.static_prompt as string) || 'A beautiful sunset over mountains';
  
  if (!static_prompt.trim()) {
    return {
      test_name: 'Text to Image',
      success: false,
      message: 'No prompt provided',
      error: 'static_prompt is required for image generation',
    };
  }
  
  const params: TextImageParams = {
    prompt: static_prompt,
  };
  
  const response = await hazo_llm_text_image(params, llm);
  
  if (!response.success) {
    return {
      test_name: 'Text to Image',
      success: false,
      message: 'Image generation failed',
      error: response.error,
    };
  }
  
  return {
    test_name: 'Text to Image',
    success: true,
    message: response.image_b64 ? 'Image generated successfully' : 'Text returned (no image)',
    data: {
      prompt: static_prompt,
      image: response.image_b64 ? {
        base64: response.image_b64,
        mime_type: response.image_mime_type || 'image/png',
      } : null,
      text: response.text,
    },
  };
}

/**
 * Test 7: Combine Images (Multiple Images → Single Image)
 * Combine two images into one based on a text prompt
 */
async function test_combine_images(body: Record<string, unknown>, llm?: string): Promise<TestResult> {
  const static_prompt = (body.static_prompt as string) || 'Combine these two images into one cohesive image';
  const images = body.images as Array<{ data: string; mime_type: string }>;
  
  if (!images || images.length < 2) {
    return {
      test_name: 'Combine Images',
      success: false,
      message: 'At least 2 images are required',
      error: 'Please provide at least 2 images in the images array',
    };
  }
  
  const params: ImageImageParams = {
    prompt: static_prompt,
    images: images.map(img => ({
      data: img.data,
      mime_type: img.mime_type,
    })),
  };
  
  const response = await hazo_llm_image_image(params, llm);
  
  if (!response.success) {
    return {
      test_name: 'Combine Images',
      success: false,
      message: 'Image combination failed',
      error: response.error,
    };
  }
  
  return {
    test_name: 'Combine Images',
    success: true,
    message: response.image_b64 ? 'Images combined successfully' : 'Text returned (no image)',
    data: {
      prompt: static_prompt,
      input_image_count: images.length,
      image: response.image_b64 ? {
        base64: response.image_b64,
        mime_type: response.image_mime_type || 'image/png',
      } : null,
      text: response.text,
    },
  };
}

/**
 * Test 8: Text → Image → Text (Chained)
 * Generate an image from a prompt, then analyze it with a second prompt
 */
async function test_text_image_text(body: Record<string, unknown>, llm?: string): Promise<TestResult> {
  const prompt_image = (body.prompt_image as string) || 'A colorful abstract painting with geometric shapes';
  const prompt_text = (body.prompt_text as string) || 'Describe this image in detail, including colors, shapes, and mood.';
  
  if (!prompt_image.trim() || !prompt_text.trim()) {
    return {
      test_name: 'Text → Image → Text',
      success: false,
      message: 'Both prompts are required',
      error: 'prompt_image and prompt_text are required',
    };
  }
  
  const params: TextImageTextParams = {
    prompt_image: prompt_image,
    prompt_text: prompt_text,
  };
  
  const response = await hazo_llm_text_image_text(params, llm);
  
  if (!response.success) {
    return {
      test_name: 'Text → Image → Text',
      success: false,
      message: 'Chained call failed',
      error: response.error,
      data: {
        prompt_image,
        prompt_text,
        // Include any partial data
        image: response.image_b64 ? {
          base64: response.image_b64,
          mime_type: response.image_mime_type || 'image/png',
        } : null,
      },
    };
  }
  
  return {
    test_name: 'Text → Image → Text',
    success: true,
    message: 'Chained call completed successfully',
    data: {
      prompt_image,
      prompt_text,
      image: response.image_b64 ? {
        base64: response.image_b64,
        mime_type: response.image_mime_type || 'image/png',
      } : null,
      analysis_text: response.text,
    },
  };
}

/**
 * Test 9: Images → Image → Text (Chained with Interim Images)
 * Chain multiple image transformations with prompts, then describe the result
 * Returns interim images from each step for visualization
 * 
 * Flow:
 * - Step 1: images[0] + images[1] + prompts[0] → result_1 (saved as interim)
 * - Step N: result_(n-1) + images[n] + prompts[n-1] → result_n (saved as interim)
 * - Final: result + description_prompt → text
 */
async function test_image_image_text(body: Record<string, unknown>, llm?: string): Promise<TestResult> {
  const images = body.images as ChainImage[];
  const prompts = body.prompts as string[];
  const description_prompt = (body.description_prompt as string) || 'Describe this final image in detail.';
  
  // Validate minimum 2 images
  if (!images || images.length < 2) {
    return {
      test_name: 'Images → Image → Text',
      success: false,
      message: 'At least two images are required',
      error: 'Minimum 2 images required for chaining',
    };
  }
  
  // Validate prompts count = images - 1
  const expected_prompts = images.length - 1;
  if (!prompts || prompts.length !== expected_prompts) {
    return {
      test_name: 'Images → Image → Text',
      success: false,
      message: `Expected ${expected_prompts} prompts for ${images.length} images`,
      error: `Got ${prompts?.length || 0} prompts, expected ${expected_prompts}`,
    };
  }
  
  // Validate each image has required fields
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (!img.image_b64 || !img.image_mime_type) {
      return {
        test_name: 'Images → Image → Text',
        success: false,
        message: `Image ${i + 1} missing required fields`,
        error: 'Each image must have image_b64 and image_mime_type',
      };
    }
  }
  
  // Validate prompts are not empty
  for (let i = 0; i < prompts.length; i++) {
    if (!prompts[i]?.trim()) {
      return {
        test_name: 'Images → Image → Text',
        success: false,
        message: `Prompt ${i + 1} is empty`,
        error: 'All prompts must have content',
      };
    }
  }
  
  // ==========================================================================
  // Run chain step-by-step to collect interim images
  // ==========================================================================
  const interim_images: Array<{ base64: string; mime_type: string; step: number }> = [];
  
  // Step 1: Combine first two images
  test_logger.info('Chain Step 1: Combining first two images', {
    file: 'route.ts',
    line: 680,
  });
  
  let current_result = await hazo_llm_image_image({
    prompt: prompts[0],
    images: [
      { data: images[0].image_b64, mime_type: images[0].image_mime_type },
      { data: images[1].image_b64, mime_type: images[1].image_mime_type },
    ],
  }, llm);
  
  if (!current_result.success || !current_result.image_b64) {
    return {
      test_name: 'Images → Image → Text',
      success: false,
      message: 'Step 1 failed: combining first two images',
      error: current_result.error || 'No image returned',
      data: { interim_images },
    };
  }
  
  // Save interim image from step 1
  interim_images.push({
    base64: current_result.image_b64,
    mime_type: current_result.image_mime_type || 'image/png',
    step: 1,
  });
  
  // Steps 2+: Chain through remaining images
  for (let i = 2; i < images.length; i++) {
    const step_num = i;
    const prompt_index = i - 1;
    
    test_logger.info(`Chain Step ${step_num}: Adding image ${i + 1}`, {
      file: 'route.ts',
      line: 710,
    });
    
    current_result = await hazo_llm_image_image({
      prompt: prompts[prompt_index],
      images: [
        { data: current_result.image_b64!, mime_type: current_result.image_mime_type! },
        { data: images[i].image_b64, mime_type: images[i].image_mime_type },
      ],
    }, llm);
    
    if (!current_result.success || !current_result.image_b64) {
      return {
        test_name: 'Images → Image → Text',
        success: false,
        message: `Step ${step_num} failed`,
        error: current_result.error || 'No image returned',
        data: { interim_images },
      };
    }
    
    // Save interim image
    interim_images.push({
      base64: current_result.image_b64,
      mime_type: current_result.image_mime_type || 'image/png',
      step: step_num,
    });
  }
  
  // Final step: Describe the final image
  test_logger.info('Chain Final Step: Generating description', {
    file: 'route.ts',
    line: 740,
  });
  
  const text_response = await hazo_llm_image_text({
    prompt: description_prompt,
    image_b64: current_result.image_b64!,
    image_mime_type: current_result.image_mime_type!,
  }, llm);
  
  if (!text_response.success) {
    return {
      test_name: 'Images → Image → Text',
      success: false,
      message: 'Description generation failed',
      error: text_response.error,
      data: {
        interim_images,
        image: {
          base64: current_result.image_b64,
          mime_type: current_result.image_mime_type || 'image/png',
        },
      },
    };
  }
  
  return {
    test_name: 'Images → Image → Text',
    success: true,
    message: 'Chained call completed successfully',
    data: {
      image_count: images.length,
      prompt_count: prompts.length,
      description_prompt,
      interim_images,
      image: {
        base64: current_result.image_b64,
        mime_type: current_result.image_mime_type || 'image/png',
      },
      description_text: text_response.text,
    },
  };
}

/**
 * Test 10: Image → Image (Transform)
 * Transform a single image based on a text prompt
 */
async function test_transform_image(body: Record<string, unknown>, llm?: string): Promise<TestResult> {
  const static_prompt = (body.static_prompt as string) || 'Transform this image';
  const image_b64 = body.image_b64 as string;
  const image_mime_type = (body.image_mime_type as string) || 'image/jpeg';
  
  if (!image_b64) {
    return {
      test_name: 'Image → Image',
      success: false,
      message: 'Image data is required',
      error: 'image_b64 is required',
    };
  }
  
  if (!static_prompt.trim()) {
    return {
      test_name: 'Image → Image',
      success: false,
      message: 'Transformation prompt is required',
      error: 'static_prompt is required',
    };
  }
  
  const params: ImageImageParams = {
    prompt: static_prompt,
    image_b64: image_b64,
    image_mime_type: image_mime_type,
  };
  
  const response = await hazo_llm_image_image(params, llm);
  
  if (!response.success) {
    return {
      test_name: 'Image → Image',
      success: false,
      message: 'Image transformation failed',
      error: response.error,
    };
  }
  
  return {
    test_name: 'Image → Image',
    success: true,
    message: response.image_b64 ? 'Image transformed successfully' : 'Text returned (no image)',
    data: {
      prompt: static_prompt,
      image: response.image_b64 ? {
        base64: response.image_b64,
        mime_type: response.image_mime_type || 'image/png',
      } : null,
      text: response.text,
    },
  };
}

/**
 * Test 11: Prompt Chain
 * Execute a chain of prompts with dynamic value resolution from previous results
 */
async function test_prompt_chain(body: Record<string, unknown>, llm?: string): Promise<TestResult> {
  const chain_calls = body.chain_calls as PromptChainParams['chain_calls'];
  const continue_on_error = (body.continue_on_error as boolean) ?? true;

  if (!chain_calls || !Array.isArray(chain_calls) || chain_calls.length === 0) {
    return {
      test_name: 'Prompt Chain',
      success: false,
      message: 'chain_calls array is required',
      error: 'Please provide a valid chain_calls array with at least one call definition',
    };
  }

  // Validate each call definition has required fields
  for (let i = 0; i < chain_calls.length; i++) {
    const call = chain_calls[i];
    if (!call.prompt_area || !call.prompt_key) {
      return {
        test_name: 'Prompt Chain',
        success: false,
        message: `Call ${i}: prompt_area and prompt_key are required`,
        error: 'Each call must have prompt_area and prompt_key fields',
      };
    }
    if (!call.prompt_area.match_type || !call.prompt_area.value) {
      return {
        test_name: 'Prompt Chain',
        success: false,
        message: `Call ${i}: prompt_area must have match_type and value`,
        error: 'Invalid prompt_area structure',
      };
    }
    if (!call.prompt_key.match_type || !call.prompt_key.value) {
      return {
        test_name: 'Prompt Chain',
        success: false,
        message: `Call ${i}: prompt_key must have match_type and value`,
        error: 'Invalid prompt_key structure',
      };
    }
  }

  const params: PromptChainParams = {
    chain_calls,
    continue_on_error,
  };

  const response = await hazo_llm_prompt_chain(params, llm);

  return {
    test_name: 'Prompt Chain',
    success: response.success,
    message: response.success
      ? `Chain completed: ${response.successful_calls}/${response.total_calls} calls succeeded`
      : `Chain failed: ${response.errors.length} errors`,
    data: {
      merged_result: response.merged_result,
      call_results: response.call_results,
      total_calls: response.total_calls,
      successful_calls: response.successful_calls,
    },
    error: response.errors.length > 0
      ? response.errors.map(e => `Call ${e.call_index}: ${e.error}`).join('; ')
      : undefined,
  };
}

// =============================================================================
// GET Handler - Get Test Status
// =============================================================================

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    initialized: is_initialized(),
    has_api_key: !!process.env.GEMINI_API_KEY,
    available_tests: [
      'static_prompt',
      'dynamic_prompt',
      'variable_substitution',
      'base64_image',
      'error_handling',
      'insert_test_prompt',
      'generate_image',
      'combine_images',
      'text_image_text',
      'image_image_text',
      'transform_image',
      'prompt_chain',
    ],
  });
}

