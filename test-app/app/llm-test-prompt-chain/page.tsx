/**
 * Prompt Chain Test Page
 *
 * Test page for the hazo_llm_prompt_chain function.
 * Provides a JSON editor for defining chain calls and displays results.
 */

'use client';

import { useState } from 'react';
import { Layout } from 'hazo_llm_api';
import { Sidebar } from '@/components/sidebar';
import { LLMSelector } from '@/components/llm-selector';
import {
  Link2,
  Loader2,
  Play,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

const API_NAME = 'hazo_llm_prompt_chain';

// =============================================================================
// Example Chain Definition
// =============================================================================

const EXAMPLE_CHAIN = `[
  {
    "prompt_area": { "match_type": "direct", "value": "general" },
    "prompt_key": { "match_type": "direct", "value": "news" }
  },
  {
    "prompt_area": { "match_type": "direct", "value": "general" },
    "prompt_key": { "match_type": "direct", "value": "country_summary" },
    "variables": [
      {
        "match_type": "call_chain",
        "value": "call[0].result.country",
        "variable_name": "country"
      }
    ]
  }
]`;

// =============================================================================
// Types
// =============================================================================

interface ChainCallResult {
  call_index: number;
  success: boolean;
  raw_text?: string;
  parsed_result?: Record<string, unknown>;
  error?: string;
  prompt_area: string;
  prompt_key: string;
}

interface ChainResponse {
  success: boolean;
  merged_result: Record<string, unknown>;
  call_results: ChainCallResult[];
  total_calls: number;
  successful_calls: number;
}

// =============================================================================
// LLM Test Prompt Chain Page Component
// =============================================================================

export default function LLMTestPromptChainPage() {
  const [chain_json, set_chain_json] = useState(EXAMPLE_CHAIN);
  const [continue_on_error, set_continue_on_error] = useState(true);
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [json_error, set_json_error] = useState<string | null>(null);
  const [response, set_response] = useState<ChainResponse | null>(null);
  const [selected_llm, set_selected_llm] = useState<string>('');
  const [copied, set_copied] = useState(false);
  const [expanded_calls, set_expanded_calls] = useState<Set<number>>(new Set());

  // ==========================================================================
  // Validate JSON
  // ==========================================================================

  const validate_json = (json_str: string): boolean => {
    try {
      const parsed = JSON.parse(json_str);
      if (!Array.isArray(parsed)) {
        set_json_error('Chain calls must be an array');
        return false;
      }
      if (parsed.length === 0) {
        set_json_error('Chain calls array cannot be empty');
        return false;
      }
      // Basic structure validation
      for (let i = 0; i < parsed.length; i++) {
        const call = parsed[i];
        if (!call.prompt_area || !call.prompt_key) {
          set_json_error(`Call ${i}: prompt_area and prompt_key are required`);
          return false;
        }
        if (!call.prompt_area.match_type || !call.prompt_area.value) {
          set_json_error(
            `Call ${i}: prompt_area must have match_type and value`
          );
          return false;
        }
        if (!call.prompt_key.match_type || !call.prompt_key.value) {
          set_json_error(
            `Call ${i}: prompt_key must have match_type and value`
          );
          return false;
        }
      }
      set_json_error(null);
      return true;
    } catch (e) {
      set_json_error(
        `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`
      );
      return false;
    }
  };

  // ==========================================================================
  // Handle Run Chain
  // ==========================================================================

  const handle_run_chain = async () => {
    if (loading) return;

    if (!validate_json(chain_json)) {
      return;
    }

    set_loading(true);
    set_error(null);
    set_response(null);

    try {
      const chain_calls = JSON.parse(chain_json);

      const res = await fetch('/api/test-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_type: 'prompt_chain',
          chain_calls,
          continue_on_error,
          llm: selected_llm || undefined,
        }),
      });

      const data = await res.json();

      if (data.data) {
        set_response(data.data as ChainResponse);
        // Expand all calls by default
        const all_indices = new Set(
          (data.data.call_results as ChainCallResult[]).map((_, i) => i)
        );
        set_expanded_calls(all_indices);
      }

      if (!data.success) {
        set_error(data.error || 'Chain execution failed');
      }
    } catch (err) {
      set_error(err instanceof Error ? err.message : String(err));
    } finally {
      set_loading(false);
    }
  };

  // ==========================================================================
  // Handle Copy Result
  // ==========================================================================

  const handle_copy_result = async () => {
    if (!response) return;

    await navigator.clipboard.writeText(
      JSON.stringify(response.merged_result, null, 2)
    );
    set_copied(true);
    setTimeout(() => set_copied(false), 2000);
  };

  // ==========================================================================
  // Handle JSON Change
  // ==========================================================================

  const handle_json_change = (value: string) => {
    set_chain_json(value);
    // Clear error when user starts typing
    if (json_error) {
      set_json_error(null);
    }
  };

  // ==========================================================================
  // Toggle Call Expansion
  // ==========================================================================

  const toggle_call_expansion = (index: number) => {
    const new_expanded = new Set(expanded_calls);
    if (new_expanded.has(index)) {
      new_expanded.delete(index);
    } else {
      new_expanded.add(index);
    }
    set_expanded_calls(new_expanded);
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <Layout sidebar={<Sidebar />}>
      <div className="cls_prompt_chain_container flex flex-col h-full p-6 max-w-6xl mx-auto overflow-auto">
        {/* Header */}
        <div className="cls_prompt_chain_header mb-6">
          <h1 className="cls_prompt_chain_title text-2xl font-bold flex items-center gap-2">
            <Link2 className="h-6 w-6 text-primary" />
            Prompt Chain
          </h1>
          <p className="cls_prompt_chain_description text-muted-foreground text-sm mt-1">
            Chain multiple text_text calls with dynamic value resolution from
            previous results
          </p>
          <div className="cls_api_badge mt-2 inline-flex items-center px-2 py-1 bg-primary/10 text-primary rounded text-xs font-mono">
            API: {API_NAME}
          </div>

          <div className="cls_controls mt-4 flex items-center gap-4 flex-wrap">
            <LLMSelector
              value={selected_llm}
              on_value_change={set_selected_llm}
              disabled={loading}
            />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={continue_on_error}
                onChange={(e) => set_continue_on_error(e.target.checked)}
                disabled={loading}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              Continue on error
            </label>
          </div>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="cls_prompt_chain_content grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
          {/* Left Column - JSON Editor */}
          <div className="cls_json_editor_section flex flex-col">
            <label className="text-sm font-medium mb-2">
              Chain Definition (JSON)
            </label>
            <div className="text-xs text-muted-foreground mb-2">
              Define an array of call definitions. Each call needs prompt_area
              and prompt_key with match_type (&quot;direct&quot; or
              &quot;call_chain&quot;) and value.
            </div>
            <textarea
              className={`cls_json_editor flex-1 min-h-[300px] p-4 border rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background ${
                json_error ? 'border-red-500' : ''
              }`}
              value={chain_json}
              onChange={(e) => handle_json_change(e.target.value)}
              disabled={loading}
              spellCheck={false}
            />
            {json_error && (
              <div className="cls_json_error mt-2 text-red-500 text-sm flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {json_error}
              </div>
            )}

            {/* Run Button */}
            <button
              className="cls_run_button mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              onClick={handle_run_chain}
              disabled={loading || !!json_error}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Running Chain...</span>
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" />
                  <span>Run Chain</span>
                </>
              )}
            </button>
          </div>

          {/* Right Column - Results */}
          <div className="cls_results_section flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Results</label>
              {response && (
                <button
                  onClick={handle_copy_result}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? 'Copied!' : 'Copy merged result'}
                </button>
              )}
            </div>

            <div className="cls_results_container flex-1 min-h-[300px] border rounded-lg bg-muted/30 overflow-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : error && !response ? (
                <div className="text-red-500">
                  <p className="font-medium">Error:</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              ) : response ? (
                <div className="space-y-4">
                  {/* Summary */}
                  <div
                    className={`p-3 rounded-lg ${response.success ? 'bg-green-500/10' : 'bg-red-500/10'}`}
                  >
                    <div className="flex items-center gap-2">
                      {response.success ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className="font-medium">
                        {response.successful_calls}/{response.total_calls} calls
                        succeeded
                      </span>
                    </div>
                  </div>

                  {/* Merged Result */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">Merged Result:</h3>
                    <pre className="p-3 bg-background rounded-lg border text-xs overflow-auto max-h-[200px]">
                      {JSON.stringify(response.merged_result, null, 2) || '{}'}
                    </pre>
                  </div>

                  {/* Individual Call Results */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">
                      Individual Calls:
                    </h3>
                    <div className="space-y-2">
                      {response.call_results.map((result, idx) => (
                        <div
                          key={idx}
                          className={`rounded-lg border text-sm ${
                            result.success
                              ? 'bg-green-500/5 border-green-500/20'
                              : 'bg-red-500/5 border-red-500/20'
                          }`}
                        >
                          <button
                            className="w-full p-3 flex items-center gap-2 text-left"
                            onClick={() => toggle_call_expansion(idx)}
                          >
                            {expanded_calls.has(idx) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${
                                result.success
                                  ? 'bg-green-500 text-white'
                                  : 'bg-red-500 text-white'
                              }`}
                            >
                              Call {result.call_index}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {result.prompt_area}/{result.prompt_key}
                            </span>
                            {result.success ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500 ml-auto" />
                            )}
                          </button>
                          {expanded_calls.has(idx) && (
                            <div className="px-3 pb-3 pt-0">
                              {result.error && (
                                <p className="text-red-500 text-xs mb-2">
                                  Error: {result.error}
                                </p>
                              )}
                              {result.raw_text && (
                                <div className="mb-2">
                                  <span className="text-xs text-muted-foreground">
                                    Raw text:
                                  </span>
                                  <pre className="mt-1 p-2 bg-background rounded text-xs overflow-auto max-h-[100px] whitespace-pre-wrap">
                                    {result.raw_text}
                                  </pre>
                                </div>
                              )}
                              {result.parsed_result && (
                                <div>
                                  <span className="text-xs text-muted-foreground">
                                    Parsed result:
                                  </span>
                                  <pre className="mt-1 p-2 bg-background rounded text-xs overflow-auto max-h-[100px]">
                                    {JSON.stringify(
                                      result.parsed_result,
                                      null,
                                      2
                                    )}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Link2 className="h-12 w-12 opacity-50" />
                  <span className="mt-2">
                    Enter chain definition and click &quot;Run Chain&quot;
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
