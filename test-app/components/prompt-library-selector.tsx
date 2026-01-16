/**
 * Prompt Input Selector Component
 * 
 * A reusable component that provides two input modes:
 * 1. Free Input - A textarea for entering custom prompts
 * 2. Prompt Library - Dropdown selection from the prompts_library database
 *    with dynamic variable inputs and real-time prompt text preview.
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { PromptRecord } from 'hazo_llm_api';
import { Loader2, Play, Send } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// =============================================================================
// Types
// =============================================================================

interface PromptVariable {
  name: string;
  description: string;
}

interface PromptLibrarySelectorProps {
  /** API endpoint to fetch prompts from */
  api_endpoint?: string;
  /** Callback when user submits/runs a prompt */
  on_submit: (prompt_text: string, variable_values: Record<string, string>) => void;
  /** Whether the submit action is currently loading */
  loading?: boolean;
  /** Custom submit button text for library mode */
  submit_button_text?: string;
  /** Whether to show the prompt preview section in library mode */
  show_preview?: boolean;
  /** Custom class name for the container */
  className?: string;
  /** Label for free input tab */
  free_input_tab_label?: string;
  /** Label for prompt library tab */
  library_tab_label?: string;
  /** Placeholder text for free input textarea */
  free_input_placeholder?: string;
  /** Default active tab */
  default_tab?: 'free' | 'library';
  /** Number of rows for free input textarea */
  free_input_rows?: number;
  /** Default text for free input textarea */
  default_free_input?: string;
}

// =============================================================================
// Prompt Library Selector Component
// =============================================================================

export function PromptLibrarySelector({
  api_endpoint = '/api/prompts',
  on_submit,
  loading = false,
  submit_button_text = 'Run',
  show_preview = true,
  className = '',
  free_input_tab_label = 'Free Input',
  library_tab_label = 'Prompt Library',
  free_input_placeholder = 'Enter your prompt here... (Press Enter to submit, Shift+Enter for new line)',
  default_tab = 'free',
  free_input_rows = 3,
  default_free_input = '',
}: PromptLibrarySelectorProps) {
  // Active Tab State
  const [active_tab, set_active_tab] = useState<string>(default_tab);
  
  // Free Input State
  const [free_input_text, set_free_input_text] = useState(default_free_input);
  
  // Prompt Library State
  const [prompts, set_prompts] = useState<PromptRecord[]>([]);
  const [selected_area, set_selected_area] = useState<string>('');
  const [selected_prompt_id, set_selected_prompt_id] = useState<string>('');
  const [fetch_loading, set_fetch_loading] = useState(false);
  const [fetch_error, set_fetch_error] = useState<string | null>(null);
  
  // Variable Values State
  const [variable_values, set_variable_values] = useState<Record<string, string>>({});

  // ==========================================================================
  // Fetch Prompts
  // ==========================================================================
  
  useEffect(() => {
    const fetch_prompts = async () => {
      set_fetch_loading(true);
      set_fetch_error(null);
      try {
        const res = await fetch(api_endpoint);
        const data = await res.json();
        if (data.success) {
          set_prompts(data.data);
        } else {
          set_fetch_error(data.error || 'Failed to fetch prompts');
        }
      } catch (err) {
        console.error('Failed to fetch prompts:', err);
        set_fetch_error(err instanceof Error ? err.message : 'Failed to fetch prompts');
      } finally {
        set_fetch_loading(false);
      }
    };
    fetch_prompts();
  }, [api_endpoint]);

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  const unique_areas = useMemo(() => {
    const areas = new Set(prompts.map(p => p.prompt_area));
    return Array.from(areas).sort();
  }, [prompts]);

  const filtered_prompts = useMemo(() => {
    if (!selected_area) return [];
    return prompts.filter(p => p.prompt_area === selected_area);
  }, [prompts, selected_area]);

  const selected_prompt = useMemo(() => {
    return prompts.find(p => p.id === selected_prompt_id);
  }, [prompts, selected_prompt_id]);

  // Parse prompt variables from JSON string
  const parsed_variables = useMemo((): PromptVariable[] => {
    if (!selected_prompt?.prompt_variables) return [];
    try {
      const parsed = JSON.parse(selected_prompt.prompt_variables);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [selected_prompt]);

  // Reset variable values when prompt changes
  useEffect(() => {
    if (selected_prompt_id) {
      const initial_values: Record<string, string> = {};
      parsed_variables.forEach(v => {
        initial_values[v.name] = '';
      });
      set_variable_values(initial_values);
    }
  }, [selected_prompt_id, parsed_variables]);

  // Substitute variables in prompt text
  const substituted_prompt_text = useMemo(() => {
    if (!selected_prompt?.prompt_text) return '';
    let text = selected_prompt.prompt_text;
    Object.entries(variable_values).forEach(([key, value]) => {
      text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `{{${key}}}`);
    });
    return text;
  }, [selected_prompt, variable_values]);

  // Check if all variables are filled
  const all_variables_filled = useMemo(() => {
    if (parsed_variables.length === 0) return true;
    return parsed_variables.every(v => variable_values[v.name]?.trim());
  }, [parsed_variables, variable_values]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handle_area_change = useCallback((area: string) => {
    set_selected_area(area);
    set_selected_prompt_id('');
    set_variable_values({});
  }, []);

  const handle_prompt_change = useCallback((prompt_id: string) => {
    set_selected_prompt_id(prompt_id);
  }, []);

  const handle_variable_change = useCallback((name: string, value: string) => {
    set_variable_values(prev => ({ ...prev, [name]: value }));
  }, []);

  const handle_free_submit = useCallback(() => {
    if (free_input_text.trim() && !loading) {
      on_submit(free_input_text, {});
    }
  }, [free_input_text, loading, on_submit]);

  const handle_library_submit = useCallback(() => {
    if (selected_prompt && all_variables_filled) {
      on_submit(substituted_prompt_text, variable_values);
    }
  }, [selected_prompt, all_variables_filled, substituted_prompt_text, variable_values, on_submit]);

  const handle_key_press = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handle_free_submit();
    }
  }, [handle_free_submit]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className={`cls_prompt_input_selector ${className}`}>
      <Tabs value={active_tab} onValueChange={set_active_tab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="free">{free_input_tab_label}</TabsTrigger>
          <TabsTrigger value="library">{library_tab_label}</TabsTrigger>
        </TabsList>

        {/* Free Input Tab */}
        <TabsContent value="free" className="mt-0">
          <div className="cls_free_input_area flex gap-2">
            <textarea
              className="cls_free_prompt_input flex-1 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              placeholder={free_input_placeholder}
              value={free_input_text}
              onChange={(e) => set_free_input_text(e.target.value)}
              onKeyDown={handle_key_press}
              rows={free_input_rows}
              disabled={loading}
            />
            <button
              className="cls_free_submit_button px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed self-end"
              onClick={handle_free_submit}
              disabled={loading || !free_input_text.trim()}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </TabsContent>

        {/* Prompt Library Tab */}
        <TabsContent value="library" className="mt-0">
          {fetch_loading ? (
            <div className="cls_prompt_library_loading p-4 border rounded-lg bg-background">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading prompts...</span>
              </div>
            </div>
          ) : fetch_error ? (
            <div className="cls_prompt_library_error p-4 border rounded-lg bg-background">
              <div className="text-red-500 text-sm">
                Error: {fetch_error}
              </div>
            </div>
          ) : (
            <div className="cls_prompt_library_content space-y-4 p-4 border rounded-lg bg-background">
              {/* Area and Key Selection Row */}
              <div className="cls_prompt_selection_row flex gap-4 items-end">
                {/* Area Dropdown */}
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium">Prompt Area</label>
                  <Select value={selected_area} onValueChange={handle_area_change}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Area" />
                    </SelectTrigger>
                    <SelectContent>
                      {unique_areas.map(area => (
                        <SelectItem key={area} value={area}>{area}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Key Dropdown */}
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium">Prompt Key</label>
                  <Select 
                    value={selected_prompt_id} 
                    onValueChange={handle_prompt_change}
                    disabled={!selected_area}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selected_area ? "Select Key" : "Select Area first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filtered_prompts.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.prompt_key}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Run Button */}
                <button
                  className="cls_prompt_library_submit_button px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed h-10 flex items-center gap-2 mb-[1px]"
                  onClick={handle_library_submit}
                  disabled={loading || !selected_prompt || !all_variables_filled}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      {submit_button_text}
                    </>
                  )}
                </button>
              </div>
              
              {/* Dynamic Variable Inputs */}
              {selected_prompt && parsed_variables.length > 0 && (
                <div className="cls_prompt_variables_section space-y-3 pt-3 border-t">
                  <label className="text-sm font-medium">Variables</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {parsed_variables.map(variable => (
                      <div key={variable.name} className="cls_prompt_variable_input space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          {variable.name}
                          {variable.description && (
                            <span className="ml-1 text-xs italic">({variable.description})</span>
                          )}
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder={`Enter ${variable.name}...`}
                          value={variable_values[variable.name] || ''}
                          onChange={(e) => handle_variable_change(variable.name, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prompt Text Preview */}
              {show_preview && selected_prompt && (
                <div className="cls_prompt_preview_section space-y-2 pt-3 border-t">
                  <label className="text-sm font-medium">
                    Prompt Text {parsed_variables.length > 0 && '(with substitutions)'}
                  </label>
                  <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap border max-h-[200px] overflow-y-auto">
                    {substituted_prompt_text}
                  </div>
                  {selected_prompt.prompt_notes && (
                    <div className="text-xs text-muted-foreground italic mt-1">
                      Note: {selected_prompt.prompt_notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PromptLibrarySelector;
