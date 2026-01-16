/**
 * Bulk Prompts API Route
 *
 * API route for bulk operations on prompts.
 * Provides DELETE (bulk delete) and POST (bulk import) endpoints.
 */

import { NextResponse } from 'next/server';
import {
  insert_prompt,
  delete_prompt,
  is_initialized,
  get_database,
  initialize_llm_api
} from 'hazo_llm_api/server';
import type { Logger, PromptRecord } from 'hazo_llm_api';
import * as fs from 'fs';
import * as path from 'path';
import * as ini from 'ini';

// =============================================================================
// Types
// =============================================================================

interface ExportedPrompt {
  prompt_area: string;
  prompt_key: string;
  local_1?: string | null;
  local_2?: string | null;
  local_3?: string | null;
  user_id?: string | null;
  scope_id?: string | null;
  prompt_text: string;
  prompt_variables?: Array<{ name: string; description: string }>;
  prompt_notes?: string;
}

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
        file: 'prompts/bulk/route.ts',
        line: 95,
        data: { error: error instanceof Error ? error.message : String(error) },
      });
      return false;
    }
  }

  return true;
}

// =============================================================================
// DELETE Handler - Bulk delete prompts
// =============================================================================

export async function DELETE(request: Request) {
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
    const { ids } = body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No IDs provided for deletion' },
        { status: 400 }
      );
    }

    let deleted_count = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        const deleted = delete_prompt(db, id, test_logger);
        if (deleted) {
          deleted_count++;
        } else {
          errors.push(`Prompt ${id} not found`);
        }
      } catch (err) {
        errors.push(`Failed to delete ${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      success: deleted_count > 0,
      deleted_count,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST Handler - Bulk import prompts
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
    const { prompts } = body as { prompts: ExportedPrompt[] };

    if (!Array.isArray(prompts) || prompts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No prompts provided for import' },
        { status: 400 }
      );
    }

    let imported_count = 0;
    const errors: string[] = [];

    for (const prompt of prompts) {
      // Validate required fields
      if (!prompt.prompt_area || !prompt.prompt_key || !prompt.prompt_text) {
        errors.push(`Invalid prompt: missing required fields (area: ${prompt.prompt_area || 'missing'}, key: ${prompt.prompt_key || 'missing'})`);
        continue;
      }

      try {
        const new_prompt: PromptRecord = {
          id: crypto.randomUUID(),
          prompt_area: prompt.prompt_area,
          prompt_key: prompt.prompt_key,
          local_1: prompt.local_1 || null,
          local_2: prompt.local_2 || null,
          local_3: prompt.local_3 || null,
          user_id: prompt.user_id || null,
          scope_id: prompt.scope_id || null,
          prompt_text: prompt.prompt_text,
          prompt_variables: JSON.stringify(prompt.prompt_variables || []),
          prompt_notes: prompt.prompt_notes || '',
          created_at: new Date().toISOString(),
          changed_at: new Date().toISOString(),
        };

        insert_prompt(db, new_prompt, test_logger);
        imported_count++;
      } catch (err) {
        errors.push(`Failed to import ${prompt.prompt_area}/${prompt.prompt_key}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      success: imported_count > 0,
      imported_count,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
