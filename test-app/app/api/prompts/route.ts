/**
 * Prompts API Route
 * 
 * API route for managing prompts in the prompts_library table.
 * Provides GET (list all) and POST (create) endpoints.
 */

import { NextResponse } from 'next/server';
import { get_all_prompts, insert_prompt, is_initialized, get_database, initialize_llm_api } from 'hazo_llm_api/server';
import type { Logger, PromptRecord } from 'hazo_llm_api';
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
  const config_path = path.resolve(process.cwd(), '..', 'hazo_llm_api_config.ini');
  
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
// Logger
// =============================================================================

const test_logger: Logger = {
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta),
  info: (msg, meta) => console.log(`[INFO] ${msg}`, meta),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta),
  debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta),
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
    
    const app_config = get_app_config();
    
    try {
      await initialize_llm_api({
        logger: test_logger,
        sqlite_path: app_config.sqlite_path,
      });
    } catch (error) {
      test_logger.error('Failed to initialize LLM API', {
        file: 'prompts/route.ts',
        line: 75,
        data: { error: error instanceof Error ? error.message : String(error) },
      });
      return false;
    }
  }
  
  return true;
}

// =============================================================================
// GET Handler - List all prompts
// =============================================================================

export async function GET() {
  try {
    const init_success = await ensure_initialized();
    if (!init_success) {
      return NextResponse.json(
        { success: false, error: 'Failed to initialize database. Check GEMINI_API_KEY.' },
        { status: 500 }
      );
    }
    
    const db = get_database();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }
    
    const prompts = get_all_prompts(db, test_logger);
    return NextResponse.json({ success: true, data: prompts });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST Handler - Create a new prompt
// =============================================================================

export async function POST(request: Request) {
  try {
    const init_success = await ensure_initialized();
    if (!init_success) {
      return NextResponse.json(
        { success: false, error: 'Failed to initialize database. Check GEMINI_API_KEY.' },
        { status: 500 }
      );
    }
    
    const db = get_database();
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }
    
    const body = await request.json();
    const { prompt_area, prompt_key, local_1, local_2, local_3, prompt_text, prompt_variables, prompt_notes } = body;

    if (!prompt_area || !prompt_key || !prompt_text) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: prompt_area, prompt_key, prompt_text' },
        { status: 400 }
      );
    }

    const new_prompt: PromptRecord = {
      uuid: crypto.randomUUID(),
      prompt_area,
      prompt_key,
      local_1: local_1 || null,
      local_2: local_2 || null,
      local_3: local_3 || null,
      prompt_text,
      prompt_variables: prompt_variables || '[]',
      prompt_notes: prompt_notes || '',
      created_at: new Date().toISOString(),
      changed_by: 'api_user',
    };

    insert_prompt(db, new_prompt, test_logger);
    
    return NextResponse.json({ success: true, data: new_prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
