/**
 * LLM Config API Route
 * 
 * API route to get enabled LLMs and primary LLM from config file
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as ini from 'ini';

// =============================================================================
// Config Reader
// =============================================================================

/**
 * Parse enabled_llms from config (supports comma-separated or JSON array)
 */
function parse_enabled_llms(value: string | undefined): string[] {
  if (!value) {
    return ['gemini']; // Default
  }
  
  const trimmed = value.trim();
  
  // Try to parse as JSON array first
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item).trim().toLowerCase()).filter(Boolean);
      }
    } catch {
      // Fall through to comma-separated parsing
    }
  }
  
  // Parse as comma-separated values
  return trimmed
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Get LLM config from hazo_llm_api_config.ini file
 */
function get_llm_config(): {
  enabled_llms: string[];
  primary_llm: string;
} {
  const config_path = path.resolve(process.cwd(), '..', 'hazo_llm_api_config.ini');
  
  const default_enabled = ['gemini'];
  const default_primary = 'gemini';
  
  if (!fs.existsSync(config_path)) {
    return {
      enabled_llms: default_enabled,
      primary_llm: default_primary,
    };
  }
  
  try {
    const config_content = fs.readFileSync(config_path, 'utf-8');
    const config = ini.parse(config_content);
    const llm_section = config.llm || {};
    
    const enabled_llms = parse_enabled_llms(llm_section.enabled_llms);
    const primary_llm = (llm_section.primary_llm || default_primary).toLowerCase();
    
    return {
      enabled_llms: enabled_llms.length > 0 ? enabled_llms : default_enabled,
      primary_llm,
    };
  } catch (error) {
    console.error('Failed to read LLM config, using defaults:', error);
    return {
      enabled_llms: default_enabled,
      primary_llm: default_primary,
    };
  }
}

// =============================================================================
// GET Handler
// =============================================================================

export async function GET() {
  try {
    const config = get_llm_config();
    
    return NextResponse.json({
      success: true,
      data: {
        enabled_llms: config.enabled_llms,
        primary_llm: config.primary_llm,
      },
    });
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json({
      success: false,
      error: error_message,
      data: {
        enabled_llms: ['gemini'],
        primary_llm: 'gemini',
      },
    }, { status: 500 });
  }
}





