/**
 * Prompt Configuration Page
 * 
 * Page for managing prompts stored in the prompts_library database.
 * Provides CRUD operations for prompts with a table view and dialog forms.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Layout } from 'hazo_llm_api';
import type { PromptRecord } from 'hazo_llm_api';
import { Sidebar } from '@/components/sidebar';
import { Settings, Plus, Pencil, Trash2, Loader2, CheckCircle, XCircle, Download, Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// =============================================================================
// Types
// =============================================================================

interface PromptVariable {
  name: string;
  description: string;
}

interface FormData {
  prompt_area: string;
  prompt_key: string;
  local_1: string;
  local_2: string;
  local_3: string;
  user_id: string;
  scope_id: string;
  prompt_text: string;
  prompt_variables: PromptVariable[];
  prompt_notes: string;
}

const empty_form_data: FormData = {
  prompt_area: '',
  prompt_key: '',
  local_1: '',
  local_2: '',
  local_3: '',
  user_id: '',
  scope_id: '',
  prompt_text: '',
  prompt_variables: [],
  prompt_notes: '',
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Sanitize identifier to lowercase alphanumeric with underscores only
 */
function sanitize_identifier(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

// =============================================================================
// Variable Entry Component
// =============================================================================

interface VariableEntryProps {
  variable: PromptVariable;
  index: number;
  on_change: (index: number, field: 'name' | 'description', value: string) => void;
  on_delete: (index: number) => void;
}

function VariableEntry({ variable, index, on_change, on_delete }: VariableEntryProps) {
  return (
    <div className="cls_variable_entry flex gap-2 items-center">
      <Input
        className="cls_variable_name_input flex-1"
        placeholder="Variable name"
        value={variable.name}
        onChange={(e) => on_change(index, 'name', sanitize_identifier(e.target.value))}
      />
      <Input
        className="cls_variable_description_input flex-1"
        placeholder="Description"
        value={variable.description}
        onChange={(e) => on_change(index, 'description', e.target.value)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => on_delete(index)}
        className="cls_variable_delete_button text-destructive hover:text-destructive"
      >
        <XCircle className="h-4 w-4" />
      </Button>
    </div>
  );
}

// =============================================================================
// Prompt Config Page Component
// =============================================================================

export default function PromptConfigPage() {
  const [prompts, set_prompts] = useState<PromptRecord[]>([]);
  const [loading, set_loading] = useState(true);
  const [error, set_error] = useState<string | null>(null);
  
  // Dialog state
  const [dialog_open, set_dialog_open] = useState(false);
  const [dialog_mode, set_dialog_mode] = useState<'create' | 'edit'>('create');
  const [editing_uuid, set_editing_uuid] = useState<string | null>(null);
  const [form_data, set_form_data] = useState<FormData>(empty_form_data);
  const [submitting, set_submitting] = useState(false);

  // Selection state
  const [selected_ids, set_selected_ids] = useState<Set<string>>(new Set());
  const [import_dialog_open, set_import_dialog_open] = useState(false);
  const [bulk_deleting, set_bulk_deleting] = useState(false);
  const [importing, set_importing] = useState(false);

  // ==========================================================================
  // Fetch Prompts
  // ==========================================================================

  const fetch_prompts = useCallback(async () => {
    set_loading(true);
    set_error(null);
    try {
      const res = await fetch('/api/prompts');
      const data = await res.json();
      if (data.success) {
        set_prompts(data.data);
      } else {
        set_error(data.error || 'Failed to fetch prompts');
      }
    } catch (err) {
      set_error(err instanceof Error ? err.message : 'Failed to fetch prompts');
    } finally {
      set_loading(false);
    }
  }, []);

  useEffect(() => {
    fetch_prompts();
  }, [fetch_prompts]);

  // ==========================================================================
  // Dialog Handlers
  // ==========================================================================

  const open_create_dialog = () => {
    set_form_data(empty_form_data);
    set_dialog_mode('create');
    set_editing_uuid(null);
    set_dialog_open(true);
  };

  const open_edit_dialog = (prompt: PromptRecord) => {
    let variables: PromptVariable[] = [];
    try {
      const parsed = JSON.parse(prompt.prompt_variables);
      variables = Array.isArray(parsed) ? parsed : [];
    } catch {
      variables = [];
    }

    set_form_data({
      prompt_area: prompt.prompt_area,
      prompt_key: prompt.prompt_key,
      local_1: prompt.local_1 || '',
      local_2: prompt.local_2 || '',
      local_3: prompt.local_3 || '',
      user_id: prompt.user_id || '',
      scope_id: prompt.scope_id || '',
      prompt_text: prompt.prompt_text,
      prompt_variables: variables,
      prompt_notes: prompt.prompt_notes,
    });
    set_dialog_mode('edit');
    set_editing_uuid(prompt.id);
    set_dialog_open(true);
  };

  const close_dialog = () => {
    set_dialog_open(false);
    set_form_data(empty_form_data);
    set_editing_uuid(null);
  };

  // ==========================================================================
  // Form Handlers
  // ==========================================================================

  const handle_field_change = (field: keyof FormData, value: string) => {
    if (field === 'prompt_area' || field === 'prompt_key' || field === 'local_1' || field === 'local_2' || field === 'local_3') {
      set_form_data(prev => ({ ...prev, [field]: sanitize_identifier(value) }));
    } else {
      set_form_data(prev => ({ ...prev, [field]: value }));
    }
  };

  const handle_variable_change = (index: number, field: 'name' | 'description', value: string) => {
    set_form_data(prev => {
      const new_variables = [...prev.prompt_variables];
      new_variables[index] = { ...new_variables[index], [field]: value };
      return { ...prev, prompt_variables: new_variables };
    });
  };

  const add_variable = () => {
    set_form_data(prev => ({
      ...prev,
      prompt_variables: [...prev.prompt_variables, { name: '', description: '' }],
    }));
  };

  const delete_variable = (index: number) => {
    set_form_data(prev => ({
      ...prev,
      prompt_variables: prev.prompt_variables.filter((_, i) => i !== index),
    }));
  };

  // ==========================================================================
  // Submit Handlers
  // ==========================================================================

  const handle_submit = async () => {
    if (!form_data.prompt_area || !form_data.prompt_key || !form_data.prompt_text) {
      set_error('Please fill in all required fields');
      return;
    }

    set_submitting(true);
    set_error(null);

    try {
      const payload = {
        prompt_area: form_data.prompt_area,
        prompt_key: form_data.prompt_key,
        local_1: form_data.local_1 || null,
        local_2: form_data.local_2 || null,
        local_3: form_data.local_3 || null,
        user_id: form_data.user_id || null,
        scope_id: form_data.scope_id || null,
        prompt_text: form_data.prompt_text,
        prompt_variables: JSON.stringify(form_data.prompt_variables.filter(v => v.name.trim())),
        prompt_notes: form_data.prompt_notes,
      };

      let res: Response;
      if (dialog_mode === 'create') {
        res = await fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/prompts/${editing_uuid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.success) {
        close_dialog();
        fetch_prompts();
      } else {
        set_error(data.error || 'Failed to save prompt');
      }
    } catch (err) {
      set_error(err instanceof Error ? err.message : 'Failed to save prompt');
    } finally {
      set_submitting(false);
    }
  };

  const handle_delete = async (uuid: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) {
      return;
    }

    try {
      const res = await fetch(`/api/prompts/${uuid}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetch_prompts();
      } else {
        set_error(data.error || 'Failed to delete prompt');
      }
    } catch (err) {
      set_error(err instanceof Error ? err.message : 'Failed to delete prompt');
    }
  };

  // ==========================================================================
  // Selection Handlers
  // ==========================================================================

  const handle_row_select = (id: string, checked: boolean) => {
    set_selected_ids(prev => {
      const new_set = new Set(prev);
      if (checked) {
        new_set.add(id);
      } else {
        new_set.delete(id);
      }
      return new_set;
    });
  };

  const handle_select_all = (checked: boolean) => {
    if (checked) {
      set_selected_ids(new Set(prompts.map(p => p.id)));
    } else {
      set_selected_ids(new Set());
    }
  };

  const is_all_selected = prompts.length > 0 && selected_ids.size === prompts.length;
  const is_some_selected = selected_ids.size > 0 && selected_ids.size < prompts.length;

  // ==========================================================================
  // Bulk Operation Handlers
  // ==========================================================================

  const handle_bulk_delete = async () => {
    if (selected_ids.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selected_ids.size} prompts? This cannot be undone.`)) {
      return;
    }

    set_bulk_deleting(true);
    set_error(null);
    try {
      const res = await fetch('/api/prompts/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected_ids) }),
      });
      const data = await res.json();
      if (data.success) {
        set_selected_ids(new Set());
        fetch_prompts();
      } else {
        set_error(data.error || 'Bulk delete failed');
      }
    } catch (err) {
      set_error(err instanceof Error ? err.message : 'Bulk delete failed');
    } finally {
      set_bulk_deleting(false);
    }
  };

  const handle_export_selected = () => {
    const selected_prompts = prompts
      .filter(p => selected_ids.has(p.id))
      .map(p => {
        let variables: PromptVariable[] = [];
        try {
          const parsed = JSON.parse(p.prompt_variables);
          variables = Array.isArray(parsed) ? parsed : [];
        } catch {
          variables = [];
        }
        return {
          prompt_area: p.prompt_area,
          prompt_key: p.prompt_key,
          local_1: p.local_1,
          local_2: p.local_2,
          local_3: p.local_3,
          user_id: p.user_id,
          scope_id: p.scope_id,
          prompt_text: p.prompt_text,
          prompt_variables: variables,
          prompt_notes: p.prompt_notes,
        };
      });

    const export_data = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      prompts: selected_prompts,
    };

    const blob = new Blob([JSON.stringify(export_data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prompts_export_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handle_import_file = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    set_importing(true);
    set_error(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate structure
      if (!data.prompts || !Array.isArray(data.prompts)) {
        throw new Error('Invalid file format: missing prompts array');
      }

      const res = await fetch('/api/prompts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompts: data.prompts }),
      });

      const result = await res.json();
      if (result.success) {
        set_import_dialog_open(false);
        fetch_prompts();
      } else {
        set_error(result.error || 'Import failed');
      }
    } catch (err) {
      set_error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      set_importing(false);
      event.target.value = ''; // Reset file input
    }
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <Layout sidebar={<Sidebar />}>
      <TooltipProvider>
        <div className="cls_prompt_config_container flex flex-col h-full p-6">
          {/* Header */}
          <div className="cls_prompt_config_header mb-6">
            <h1 className="cls_prompt_config_title text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6 text-primary" />
              Prompt Configuration
            </h1>
            <p className="cls_prompt_config_description text-muted-foreground text-sm">
              Manage LLM prompts stored in the prompts_library database
            </p>
          </div>

        {/* Error Display */}
        {error && (
          <div className="cls_error_banner mb-4 p-3 bg-destructive/10 text-destructive rounded-lg">
            {error}
          </div>
        )}

        {/* Actions Row */}
        <div className="cls_actions_row mb-4 flex items-center gap-2 flex-wrap">
          <Button onClick={open_create_dialog} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Prompt
          </Button>

          {/* Bulk action buttons - show when items selected */}
          {selected_ids.size > 0 && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handle_export_selected}
                    className="cls_export_button flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export ({selected_ids.size})
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-medium mb-1">Download selected prompts as JSON</p>
                  <p className="text-xs text-muted-foreground">
                    Exports to a file that can be imported later
                  </p>
                </TooltipContent>
              </Tooltip>

              <Button
                variant="destructive"
                onClick={handle_bulk_delete}
                disabled={bulk_deleting}
                className="cls_bulk_delete_button flex items-center gap-2"
              >
                {bulk_deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete ({selected_ids.size})
              </Button>
            </>
          )}

          {/* Import button - always visible */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={() => set_import_dialog_open(true)}
                className="cls_import_button flex items-center gap-2 ml-auto"
              >
                <Upload className="h-4 w-4" />
                Import
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <p className="font-medium mb-1">Import prompts from JSON file</p>
              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
{`{
  "prompts": [{
    "prompt_area": "...",
    "prompt_key": "...",
    "prompt_text": "..."
  }]
}`}
              </pre>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Prompts Table */}
        <div className="cls_prompts_table_container flex-1 border rounded-lg overflow-auto">
          {loading ? (
            <div className="cls_loading_state flex items-center justify-center h-32 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading prompts...
            </div>
          ) : prompts.length === 0 ? (
            <div className="cls_empty_state flex items-center justify-center h-32 text-muted-foreground">
              No prompts found. Click &quot;Add Prompt&quot; to create one.
            </div>
          ) : (
            <table className="cls_prompts_table w-full">
              <thead className="cls_table_header bg-muted/50 sticky top-0">
                <tr>
                  <th className="cls_th_select text-center p-3 w-[50px]">
                    <Checkbox
                      checked={is_all_selected}
                      onCheckedChange={(checked) => handle_select_all(checked as boolean)}
                      className="cls_select_all_checkbox"
                      aria-label="Select all prompts"
                      {...(is_some_selected ? { 'data-state': 'indeterminate' } : {})}
                    />
                  </th>
                  <th className="cls_th_area text-left p-3 font-medium text-sm min-w-[100px]">Area</th>
                  <th className="cls_th_key text-left p-3 font-medium text-sm min-w-[120px]">Key</th>
                  <th className="cls_th_locals text-left p-3 font-medium text-sm min-w-[150px]">Local Filters</th>
                  <th className="cls_th_ownership text-left p-3 font-medium text-sm min-w-[120px]">Ownership</th>
                  <th className="cls_th_text text-left p-3 font-medium text-sm min-w-[200px]">Prompt Text</th>
                  <th className="cls_th_variables text-left p-3 font-medium text-sm min-w-[150px]">Variables</th>
                  <th className="cls_th_actions text-center p-3 font-medium text-sm w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody className="cls_table_body">
                {prompts.map((prompt) => {
                  let variables: PromptVariable[] = [];
                  try {
                    const parsed = JSON.parse(prompt.prompt_variables);
                    variables = Array.isArray(parsed) ? parsed : [];
                  } catch {
                    variables = [];
                  }

                  const locals = [prompt.local_1, prompt.local_2, prompt.local_3].filter(Boolean);

                  return (
                    <tr key={prompt.id} className="cls_table_row border-b hover:bg-muted/30">
                      <td className="cls_td_select text-center p-3">
                        <Checkbox
                          checked={selected_ids.has(prompt.id)}
                          onCheckedChange={(checked) => handle_row_select(prompt.id, checked as boolean)}
                          className="cls_row_checkbox"
                          aria-label={`Select prompt ${prompt.prompt_area}/${prompt.prompt_key}`}
                        />
                      </td>
                      <td className="cls_td_area p-3 text-sm break-words">{prompt.prompt_area}</td>
                      <td className="cls_td_key p-3 text-sm break-words">{prompt.prompt_key}</td>
                      <td className="cls_td_locals p-3 text-sm break-words">
                        {locals.length > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {locals.join(' → ')}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Base</span>
                        )}
                      </td>
                      <td className="cls_td_ownership p-3 text-sm break-words">
                        {(prompt.user_id || prompt.scope_id) ? (
                          <span className="text-xs text-muted-foreground">
                            {prompt.user_id && <span title={prompt.user_id}>U: {prompt.user_id.slice(0, 8)}...</span>}
                            {prompt.user_id && prompt.scope_id && <br />}
                            {prompt.scope_id && <span title={prompt.scope_id}>S: {prompt.scope_id.slice(0, 8)}...</span>}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Global</span>
                        )}
                      </td>
                      <td className="cls_td_text p-3 text-sm break-words max-w-[300px]">
                        <span className="line-clamp-2">{prompt.prompt_text}</span>
                      </td>
                      <td className="cls_td_variables p-3 text-sm break-words">
                        {variables.length > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {variables.map(v => v.name).join(', ')}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">None</span>
                        )}
                      </td>
                      <td className="cls_td_actions p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => open_edit_dialog(prompt)}
                            className="cls_edit_button h-8 w-8"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handle_delete(prompt.id)}
                            className="cls_delete_button h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={dialog_open} onOpenChange={set_dialog_open}>
          <DialogContent className="cls_prompt_dialog max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <DialogHeader className="flex-none">
              <DialogTitle>
                {dialog_mode === 'create' ? 'Create New Prompt' : 'Edit Prompt'}
              </DialogTitle>
              <DialogDescription>
                {dialog_mode === 'create' 
                  ? 'Add a new prompt to the library.' 
                  : 'Update the prompt details.'}
              </DialogDescription>
            </DialogHeader>

            <div className="cls_dialog_body flex-1 overflow-y-auto space-y-4 py-4" style={{ minHeight: 0 }}>
              {/* Prompt Area */}
              <div className="cls_field_area space-y-2">
                <label className="text-sm font-medium">
                  Prompt Area <span className="text-destructive">*</span>
                </label>
                <Input
                  className="cls_prompt_area_input"
                  placeholder="e.g., marketing, support, generation"
                  value={form_data.prompt_area}
                  onChange={(e) => handle_field_change('prompt_area', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Lowercase, single word only</p>
              </div>

              {/* Prompt Key */}
              <div className="cls_field_key space-y-2">
                <label className="text-sm font-medium">
                  Prompt Key <span className="text-destructive">*</span>
                </label>
                <Input
                  className="cls_prompt_key_input"
                  placeholder="e.g., greeting, summary, analysis"
                  value={form_data.prompt_key}
                  onChange={(e) => handle_field_change('prompt_key', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Lowercase, single word only</p>
              </div>

              {/* Local Filters */}
              <div className="cls_field_locals space-y-2">
                <label className="text-sm font-medium">Local Filters (Optional)</label>
                <p className="text-xs text-muted-foreground mb-2">
                  Localization filters for more specific prompt variants. Leave empty for base prompt.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Input
                      className="cls_local_1_input"
                      placeholder="local_1"
                      value={form_data.local_1}
                      onChange={(e) => handle_field_change('local_1', e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      className="cls_local_2_input"
                      placeholder="local_2"
                      value={form_data.local_2}
                      onChange={(e) => handle_field_change('local_2', e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      className="cls_local_3_input"
                      placeholder="local_3"
                      value={form_data.local_3}
                      onChange={(e) => handle_field_change('local_3', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* User ID and Scope ID */}
              <div className="cls_field_ownership space-y-2">
                <label className="text-sm font-medium">Ownership (Optional)</label>
                <p className="text-xs text-muted-foreground mb-2">
                  Optional identifiers for user-specific or scope-specific prompts.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">User ID</label>
                    <Input
                      className="cls_user_id_input"
                      placeholder="User UUID"
                      value={form_data.user_id}
                      onChange={(e) => handle_field_change('user_id', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Scope ID</label>
                    <Input
                      className="cls_scope_id_input"
                      placeholder="Scope UUID"
                      value={form_data.scope_id}
                      onChange={(e) => handle_field_change('scope_id', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Prompt Text */}
              <div className="cls_field_text space-y-2">
                <label className="text-sm font-medium">
                  Prompt Text <span className="text-destructive">*</span>
                </label>
                <Textarea
                  className="cls_prompt_text_input min-h-[100px]"
                  placeholder="Enter your prompt text. Use {{variable_name}} for variables, e.g., Give me info about {{country}}"
                  value={form_data.prompt_text}
                  onChange={(e) => handle_field_change('prompt_text', e.target.value)}
                  rows={4}
                />
              </div>

              {/* Prompt Variables */}
              <div className="cls_field_variables space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Variables</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={add_variable}
                    className="cls_add_variable_button"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Variable
                  </Button>
                </div>
                <div className="space-y-2">
                  {form_data.prompt_variables.map((variable, index) => (
                    <VariableEntry
                      key={index}
                      variable={variable}
                      index={index}
                      on_change={handle_variable_change}
                      on_delete={delete_variable}
                    />
                  ))}
                  {form_data.prompt_variables.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      No variables defined. Click &quot;Add Variable&quot; to add one.
                    </p>
                  )}
                </div>
              </div>

              {/* Prompt Notes */}
              <div className="cls_field_notes space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  className="cls_prompt_notes_input"
                  placeholder="Optional notes about this prompt"
                  value={form_data.prompt_notes}
                  onChange={(e) => handle_field_change('prompt_notes', e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter className="flex-none">
              <Button variant="outline" onClick={close_dialog} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={handle_submit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {dialog_mode === 'create' ? 'Create' : 'Update'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={import_dialog_open} onOpenChange={set_import_dialog_open}>
          <DialogContent className="cls_import_dialog max-w-md">
            <DialogHeader>
              <DialogTitle>Import Prompts</DialogTitle>
              <DialogDescription>
                Upload a JSON file to import prompts. The file should match the export format.
              </DialogDescription>
            </DialogHeader>

            <div className="cls_import_body py-4">
              <div className="cls_format_info mb-4 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Expected JSON format:</p>
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
{`{
  "version": "1.0",
  "prompts": [
    {
      "prompt_area": "marketing",
      "prompt_key": "greeting",
      "prompt_text": "Hello {{name}}...",
      "prompt_variables": [
        { "name": "name", "description": "..." }
      ],
      "prompt_notes": "..."
    }
  ]
}`}
                </pre>
              </div>

              <Input
                type="file"
                accept=".json"
                onChange={handle_import_file}
                disabled={importing}
                className="cls_file_input"
              />

              {importing && (
                <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing prompts...
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => set_import_dialog_open(false)} disabled={importing}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </TooltipProvider>
    </Layout>
  );
}


