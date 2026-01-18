/**
 * Prompt by UUID API Route
 * 
 * API route for managing individual prompts by UUID.
 * Provides GET (single), PUT (update), and DELETE endpoints.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  get_prompt_by_id,
  update_prompt,
  delete_prompt,
  is_initialized,
  get_database,
  initialize_llm_api
} from 'hazo_llm_api/server';
import * as fs from 'fs';
import * as path from 'path';
import * as ini from 'ini';
import { logger } from '@/lib/logger';

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
        logger: logger,
        sqlite_path: app_config.sqlite_path,
      });
    } catch (error) {
      logger.error('Failed to initialize LLM API', {
        file: 'prompts/[uuid]/route.ts',
        line: 85,
        data: { error: error instanceof Error ? error.message : String(error) },
      });
      return false;
    }
  }
  
  return true;
}

// =============================================================================
// GET Handler - Get single prompt by UUID
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;
    
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
    
    const prompt = get_prompt_by_id(db, uuid, logger);
    
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT Handler - Update prompt by UUID
// =============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;
    
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
    const { prompt_area, prompt_key, local_1, local_2, local_3, user_id, scope_id, prompt_text, prompt_variables, prompt_notes, next_prompt } = body;

    const updates: Record<string, string | null> = {};
    if (prompt_area !== undefined) updates.prompt_area = prompt_area;
    if (prompt_key !== undefined) updates.prompt_key = prompt_key;
    if (local_1 !== undefined) updates.local_1 = local_1 || null;
    if (local_2 !== undefined) updates.local_2 = local_2 || null;
    if (local_3 !== undefined) updates.local_3 = local_3 || null;
    if (user_id !== undefined) updates.user_id = user_id || null;
    if (scope_id !== undefined) updates.scope_id = scope_id || null;
    if (prompt_text !== undefined) updates.prompt_text = prompt_text;
    if (prompt_variables !== undefined) updates.prompt_variables = prompt_variables;
    if (prompt_notes !== undefined) updates.prompt_notes = prompt_notes;
    if (next_prompt !== undefined) updates.next_prompt = next_prompt || null;
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }
    
    const updated_prompt = update_prompt(db, uuid, updates, logger);
    
    if (!updated_prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt not found or update failed' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, data: updated_prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE Handler - Delete prompt by UUID
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;
    
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
    
    const deleted = delete_prompt(db, uuid, logger);
    
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Prompt not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, message: 'Prompt deleted successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}


