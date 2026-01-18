/**
 * hazo_logs Config Parser
 *
 * Parses logging configuration from INI files.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ini from 'ini';
import type { HazoLoggerConfig, LogLevel } from './types.js';

/**
 * Valid log levels for validation
 */
const VALID_LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

/**
 * Parse logging configuration from an INI file
 *
 * Expected INI format:
 * ```ini
 * [logging]
 * logfile=logs/hazo_llm_api.log
 * level=info
 * max_size=10m
 * max_files=5
 * console_enabled=true
 * ```
 *
 * @param ini_path - Path to the INI configuration file
 * @returns HazoLoggerConfig object
 * @throws Error if the file cannot be read or parsed
 */
export function parse_logging_config(ini_path: string): HazoLoggerConfig {
  // Resolve the path
  const resolved_path = path.resolve(ini_path);

  // Check if file exists
  if (!fs.existsSync(resolved_path)) {
    throw new Error(`Config file not found: ${resolved_path}`);
  }

  // Read and parse the INI file
  const config_content = fs.readFileSync(resolved_path, 'utf-8');
  const config = ini.parse(config_content);

  // Get the logging section
  const logging_section = config.logging;
  if (!logging_section) {
    throw new Error(`[logging] section not found in config file: ${resolved_path}`);
  }

  // Parse log file path (required)
  const log_file = logging_section.logfile;
  if (!log_file) {
    throw new Error('logfile is required in [logging] section');
  }

  // Resolve log file path relative to config file directory if not absolute
  const config_dir = path.dirname(resolved_path);
  const resolved_log_file = path.isAbsolute(log_file)
    ? log_file
    : path.resolve(config_dir, '..', log_file);

  // Parse log level (default: 'info')
  let log_level: LogLevel = 'info';
  if (logging_section.level) {
    const level = logging_section.level.toLowerCase() as LogLevel;
    if (VALID_LOG_LEVELS.includes(level)) {
      log_level = level;
    } else {
      console.warn(`Invalid log level '${logging_section.level}', using 'info'`);
    }
  }

  // Parse max_size (optional)
  const max_size = logging_section.max_size || undefined;

  // Parse max_files (optional)
  let max_files: number | undefined;
  if (logging_section.max_files) {
    const parsed = parseInt(logging_section.max_files, 10);
    if (!isNaN(parsed) && parsed > 0) {
      max_files = parsed;
    }
  }

  // Parse console_enabled (default: true)
  let console_enabled = true;
  if (logging_section.console_enabled !== undefined) {
    const value = logging_section.console_enabled.toString().toLowerCase();
    console_enabled = value === 'true' || value === '1' || value === 'yes';
  }

  return {
    log_file: resolved_log_file,
    log_level,
    max_size,
    max_files,
    console_enabled,
  };
}
