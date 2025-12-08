/**
 * Text → Text Test Page
 * 
 * Test page for text-to-text LLM calls using hazo_llm_text_text.
 * API: hazo_llm_text_text
 */

'use client';

import { useState } from 'react';
import { Layout } from 'hazo_llm_api';
import { Sidebar } from '@/components/sidebar';
import { PromptLibrarySelector } from '@/components/prompt-library-selector';
import { LLMSelector } from '@/components/llm-selector';
import { Loader2, Type } from 'lucide-react';

const API_NAME = 'hazo_llm_text_text';

// =============================================================================
// LLM Test Page Component
// =============================================================================

export default function LLMTestPage() {
  const [response, set_response] = useState('');
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [selected_llm, set_selected_llm] = useState<string>('');

  // ==========================================================================
  // Submit Prompt Handler
  // ==========================================================================

  const handle_submit = async (prompt_text: string) => {
    if (!prompt_text.trim() || loading) return;

    set_loading(true);
    set_error(null);
    set_response('');

    try {
      const res = await fetch('/api/test-llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_type: 'static_prompt',
          static_prompt: prompt_text,
          llm: selected_llm || undefined,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get response');
      }

      // Extract response text from data
      const response_text = data.data?.response_text || JSON.stringify(data.data, null, 2);
      set_response(response_text);
    } catch (err) {
      const error_message = err instanceof Error ? err.message : String(err);
      set_error(error_message);
    } finally {
      set_loading(false);
    }
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <Layout sidebar={<Sidebar />}>
      <div className="cls_llm_test_container flex flex-col h-full p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="cls_llm_test_header mb-6">
          <h1 className="cls_llm_test_title text-2xl font-bold flex items-center gap-2">
            <Type className="h-6 w-6 text-primary" />
            Text → Text
          </h1>
          <p className="cls_llm_test_description text-muted-foreground text-sm">
            Enter a text prompt and get a text response from the LLM
          </p>
          <div className="cls_api_badge mt-2 inline-flex items-center px-2 py-1 bg-primary/10 text-primary rounded text-xs font-mono">
            API: {API_NAME}
          </div>
          <div className="cls_llm_selector_wrapper mt-4">
            <LLMSelector
              value={selected_llm}
              on_value_change={set_selected_llm}
              disabled={loading}
            />
          </div>
        </div>

        {/* Response Area */}
        <div className="cls_response_area flex-1 mb-4 min-h-[200px] p-4 border rounded-lg bg-muted/30 overflow-auto">
          {loading ? (
            <div className="cls_loading_state flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating response...</span>
            </div>
          ) : error ? (
            <div className="cls_error_state text-red-500">
              <p className="font-medium">Error:</p>
              <p>{error}</p>
            </div>
          ) : response ? (
            <div className="cls_response_content whitespace-pre-wrap">
              {response}
            </div>
          ) : (
            <div className="cls_empty_state text-muted-foreground">
              Response will appear here...
            </div>
          )}
        </div>

        {/* Prompt Input Selector with Tabs */}
        <PromptLibrarySelector
          api_endpoint="/api/prompts"
          on_submit={handle_submit}
          loading={loading}
          submit_button_text="Run"
          show_preview={true}
        />
      </div>
    </Layout>
  );
}
