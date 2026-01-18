/**
 * Dynamic Data Extract Test Page
 *
 * Test page for the hazo_llm_dynamic_data_extract function.
 * Tests dynamic prompt chaining where next prompt is determined by JSON output.
 */

'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Layout } from 'hazo_llm_api';
import type { PromptRecord } from 'hazo_llm_api';
import { Sidebar } from '@/components/sidebar';
import { LLMSelector } from '@/components/llm-selector';
import {
  Zap,
  Loader2,
  Play,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Upload,
  X,
} from 'lucide-react';

const API_NAME = 'hazo_llm_dynamic_data_extract';

// =============================================================================
// Types
// =============================================================================

interface StepResult {
  step_index: number;
  success: boolean;
  prompt_area: string;
  prompt_key: string;
  raw_text?: string;
  parsed_result?: Record<string, unknown>;
  error?: string;
  next_prompt_resolution?: {
    config: Record<string, unknown> | null;
    resolved_area?: string;
    resolved_key?: string;
    matched_branch?: string;
    branch_index?: number;
  };
}

interface DynamicExtractResponse {
  success: boolean;
  merged_result: Record<string, unknown>;
  step_results: StepResult[];
  total_steps: number;
  successful_steps: number;
  final_stop_reason: string;
}

// =============================================================================
// LLM Test Dynamic Extract Page Component
// =============================================================================

export default function LLMTestDynamicExtractPage() {
  const [initial_prompt_area, set_initial_prompt_area] = useState('');
  const [initial_prompt_key, set_initial_prompt_key] = useState('');
  const [max_depth, set_max_depth] = useState(10);
  const [continue_on_error, set_continue_on_error] = useState(false);
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [response, set_response] = useState<DynamicExtractResponse | null>(null);
  const [selected_llm, set_selected_llm] = useState<string>('');
  const [copied, set_copied] = useState(false);
  const [expanded_steps, set_expanded_steps] = useState<Set<number>>(new Set());

  // Document upload state
  const [doc_b64, set_doc_b64] = useState<string | null>(null);
  const [doc_mime_type, set_doc_mime_type] = useState<string | null>(null);
  const [doc_preview, set_doc_preview] = useState<string | null>(null);
  const [doc_name, set_doc_name] = useState<string | null>(null);
  const file_input_ref = useRef<HTMLInputElement>(null);

  // Prompts state for dropdowns
  const [prompts, set_prompts] = useState<PromptRecord[]>([]);
  const [prompts_loading, set_prompts_loading] = useState(true);

  // ==========================================================================
  // Fetch Prompts on Mount
  // ==========================================================================

  useEffect(() => {
    async function fetch_prompts() {
      try {
        const res = await fetch('/api/prompts');
        const data = await res.json();
        if (data.success && data.data) {
          set_prompts(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch prompts:', err);
      } finally {
        set_prompts_loading(false);
      }
    }
    fetch_prompts();
  }, []);

  // Compute unique prompt areas
  const unique_areas = useMemo(() => {
    const areas = new Set(prompts.map((p) => p.prompt_area));
    return Array.from(areas).sort();
  }, [prompts]);

  // Compute prompt keys for selected area
  const keys_for_area = useMemo(() => {
    if (!initial_prompt_area) return [];
    return prompts
      .filter((p) => p.prompt_area === initial_prompt_area)
      .map((p) => p.prompt_key)
      .sort();
  }, [prompts, initial_prompt_area]);

  // Reset prompt_key when area changes
  useEffect(() => {
    set_initial_prompt_key('');
  }, [initial_prompt_area]);

  // ==========================================================================
  // Handle Document Upload
  // ==========================================================================

  const handle_document_upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data_url = event.target?.result as string;
      // Extract base64 data (remove data:mime/type;base64, prefix)
      const base64 = data_url.split(',')[1];
      set_doc_b64(base64);
      set_doc_mime_type(file.type);
      set_doc_name(file.name);
      // Only set preview for images
      if (file.type.startsWith('image/')) {
        set_doc_preview(data_url);
      } else {
        set_doc_preview(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const clear_document = () => {
    set_doc_b64(null);
    set_doc_mime_type(null);
    set_doc_preview(null);
    set_doc_name(null);
    if (file_input_ref.current) {
      file_input_ref.current.value = '';
    }
  };

  // ==========================================================================
  // Handle Run Extract
  // ==========================================================================

  const handle_run_extract = async () => {
    if (loading) return;

    if (!initial_prompt_area.trim() || !initial_prompt_key.trim()) {
      set_error('Please provide both prompt area and prompt key');
      return;
    }

    set_loading(true);
    set_error(null);
    set_response(null);

    try {
      const res = await fetch('/api/test-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_type: 'dynamic_data_extract',
          initial_prompt_area: initial_prompt_area.trim(),
          initial_prompt_key: initial_prompt_key.trim(),
          max_depth,
          continue_on_error,
          image_b64: doc_b64 || undefined,
          image_mime_type: doc_mime_type || undefined,
          llm: selected_llm || undefined,
        }),
      });

      const data = await res.json();

      if (data.data) {
        set_response(data.data as DynamicExtractResponse);
        // Expand all steps by default
        const all_indices = new Set(
          (data.data.step_results as StepResult[]).map((_, i) => i)
        );
        set_expanded_steps(all_indices);
      }

      if (!data.success) {
        set_error(data.error || 'Dynamic extract failed');
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
  // Toggle Step Expansion
  // ==========================================================================

  const toggle_step_expansion = (index: number) => {
    const new_expanded = new Set(expanded_steps);
    if (new_expanded.has(index)) {
      new_expanded.delete(index);
    } else {
      new_expanded.add(index);
    }
    set_expanded_steps(new_expanded);
  };

  // ==========================================================================
  // Get stop reason color and label
  // ==========================================================================

  const get_stop_reason_info = (reason: string) => {
    switch (reason) {
      case 'no_next_prompt':
        return { color: 'text-green-600', label: 'Normal completion' };
      case 'max_depth':
        return { color: 'text-yellow-600', label: 'Max depth reached' };
      case 'error':
        return { color: 'text-red-600', label: 'Error' };
      case 'next_prompt_not_found':
        return { color: 'text-orange-600', label: 'Next prompt not found' };
      default:
        return { color: 'text-gray-600', label: reason };
    }
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <Layout sidebar={<Sidebar />}>
      <div className="cls_dynamic_extract_container flex flex-col h-full p-6 max-w-6xl mx-auto overflow-auto">
        {/* Header */}
        <div className="cls_dynamic_extract_header mb-6">
          <h1 className="cls_dynamic_extract_title text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Dynamic Data Extract
          </h1>
          <p className="cls_dynamic_extract_description text-muted-foreground text-sm mt-1">
            Execute a chain where each next prompt is determined by JSON output
            from the current call
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
          </div>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="cls_dynamic_extract_content grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
          {/* Left Column - Input */}
          <div className="cls_input_section flex flex-col space-y-4">
            {/* Initial Prompt */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Initial Prompt</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={initial_prompt_area}
                  onChange={(e) => set_initial_prompt_area(e.target.value)}
                  disabled={loading || prompts_loading}
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                >
                  <option value="">
                    {prompts_loading ? 'Loading...' : 'Select Prompt Area'}
                  </option>
                  {unique_areas.map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
                <select
                  value={initial_prompt_key}
                  onChange={(e) => set_initial_prompt_key(e.target.value)}
                  disabled={loading || prompts_loading || !initial_prompt_area}
                  className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                >
                  <option value="">
                    {!initial_prompt_area ? 'Select area first' : 'Select Prompt Key'}
                  </option>
                  {keys_for_area.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                The starting prompt for the chain. Must have next_prompt configured in the database.
              </p>
            </div>

            {/* Document Upload (Optional) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Document (Optional)</label>
              <p className="text-xs text-muted-foreground">
                Upload any document (image, PDF, etc.). Will be passed to all steps in the chain.
              </p>
              <div className="flex items-center gap-2">
                <input
                  ref={file_input_ref}
                  type="file"
                  onChange={handle_document_upload}
                  disabled={loading}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => file_input_ref.current?.click()}
                  disabled={loading}
                  className="px-3 py-2 border rounded-lg hover:bg-muted/50 flex items-center gap-2 text-sm"
                >
                  <Upload className="h-4 w-4" />
                  Upload Document
                </button>
                {doc_name && (
                  <button
                    type="button"
                    onClick={clear_document}
                    disabled={loading}
                    className="px-2 py-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {doc_name && (
                <div className="mt-2">
                  {doc_preview ? (
                    <img
                      src={doc_preview}
                      alt="Preview"
                      className="max-h-32 rounded-lg border"
                    />
                  ) : (
                    <div className="p-3 rounded-lg border bg-muted/30 text-sm">
                      <span className="text-muted-foreground">File: </span>
                      <span className="font-medium">{doc_name}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Options</label>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-sm">Max Depth:</label>
                  <input
                    type="number"
                    value={max_depth}
                    onChange={(e) => set_max_depth(parseInt(e.target.value) || 10)}
                    disabled={loading}
                    min={1}
                    max={50}
                    className="w-16 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                  />
                </div>
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

            {/* Run Button */}
            <button
              className="cls_run_button mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              onClick={handle_run_extract}
              disabled={loading || !initial_prompt_area.trim() || !initial_prompt_key.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Running Chain...</span>
                </>
              ) : (
                <>
                  <Play className="h-5 w-5" />
                  <span>Run Dynamic Extract</span>
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

            <div className="cls_results_container flex-1 min-h-[400px] border rounded-lg bg-muted/30 overflow-auto p-4">
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
                        {response.successful_steps}/{response.total_steps} steps
                        succeeded
                      </span>
                    </div>
                    <div className="mt-1 text-sm">
                      <span className="text-muted-foreground">Stop reason: </span>
                      <span className={get_stop_reason_info(response.final_stop_reason).color}>
                        {get_stop_reason_info(response.final_stop_reason).label}
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

                  {/* Individual Step Results */}
                  <div>
                    <h3 className="text-sm font-medium mb-2">
                      Step Details:
                    </h3>
                    <div className="space-y-2">
                      {response.step_results.map((result, idx) => (
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
                            onClick={() => toggle_step_expansion(idx)}
                          >
                            {expanded_steps.has(idx) ? (
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
                              Step {result.step_index}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {result.prompt_area}/{result.prompt_key}
                            </span>
                            {result.next_prompt_resolution?.resolved_area && (
                              <span className="text-xs text-blue-500">
                                &rarr; {result.next_prompt_resolution.resolved_area}/
                                {result.next_prompt_resolution.resolved_key}
                              </span>
                            )}
                            {result.success ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500 ml-auto" />
                            )}
                          </button>
                          {expanded_steps.has(idx) && (
                            <div className="px-3 pb-3 pt-0 space-y-2">
                              {result.error && (
                                <p className="text-red-500 text-xs">
                                  Error: {result.error}
                                </p>
                              )}
                              {result.raw_text && (
                                <div>
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
                              {result.next_prompt_resolution?.config && (
                                <div>
                                  <span className="text-xs text-muted-foreground">
                                    Next prompt resolution:
                                  </span>
                                  <div className="mt-1 p-2 bg-background rounded text-xs space-y-1">
                                    {result.next_prompt_resolution.matched_branch && (
                                      <p>
                                        <span className="text-muted-foreground">Branch: </span>
                                        <span className="text-blue-500">
                                          {result.next_prompt_resolution.matched_branch}
                                          {result.next_prompt_resolution.branch_index !== undefined &&
                                            ` [${result.next_prompt_resolution.branch_index}]`}
                                        </span>
                                      </p>
                                    )}
                                    {result.next_prompt_resolution.resolved_area && (
                                      <p>
                                        <span className="text-muted-foreground">Next: </span>
                                        <span>
                                          {result.next_prompt_resolution.resolved_area}/
                                          {result.next_prompt_resolution.resolved_key}
                                        </span>
                                      </p>
                                    )}
                                  </div>
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
                  <Zap className="h-12 w-12 opacity-50" />
                  <span className="mt-2">
                    Enter prompt area/key and click &quot;Run Dynamic Extract&quot;
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
