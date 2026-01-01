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
import { Settings, Plus, Pencil, Trash2, Loader2, CheckCircle, XCircle } from 'lucide-react';
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
      prompt_text: prompt.prompt_text,
      prompt_variables: variables,
      prompt_notes: prompt.prompt_notes,
    });
    set_dialog_mode('edit');
    set_editing_uuid(prompt.uuid);
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
  // Render
  // ==========================================================================

  return (
    <Layout sidebar={<Sidebar />}>
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

        {/* Add Button */}
        <div className="cls_actions_row mb-4">
          <Button onClick={open_create_dialog} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Prompt
          </Button>
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
                  <th className="cls_th_area text-left p-3 font-medium text-sm min-w-[100px]">Area</th>
                  <th className="cls_th_key text-left p-3 font-medium text-sm min-w-[120px]">Key</th>
                  <th className="cls_th_locals text-left p-3 font-medium text-sm min-w-[150px]">Local Filters</th>
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
                    <tr key={prompt.uuid} className="cls_table_row border-b hover:bg-muted/30">
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
                            onClick={() => handle_delete(prompt.uuid)}
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
      </div>
    </Layout>
  );
}


