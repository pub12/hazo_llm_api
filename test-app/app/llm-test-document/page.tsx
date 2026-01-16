/**
 * Document → Text Test Page
 *
 * Test page for document-to-text LLM calls using hazo_llm_document_text.
 * Upload a PDF document and get a text analysis.
 * API: hazo_llm_document_text
 */

'use client';

import { useState, useCallback } from 'react';
import { Layout } from 'hazo_llm_api';
import { Sidebar } from '@/components/sidebar';
import { PromptLibrarySelector } from '@/components/prompt-library-selector';
import { LLMSelector } from '@/components/llm-selector';
import { Loader2, Upload, FileText, X } from 'lucide-react';

const API_NAME = 'hazo_llm_document_text';

// =============================================================================
// Types
// =============================================================================

interface UploadedDocument {
  file: File;
  base64: string;
  mime_type: string;
}

// =============================================================================
// LLM Test Document Page Component
// =============================================================================

export default function LLMTestDocumentPage() {
  const [response, set_response] = useState('');
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [uploaded_document, set_uploaded_document] = useState<UploadedDocument | null>(null);
  const [is_dragging, set_is_dragging] = useState(false);
  const [selected_llm, set_selected_llm] = useState<string>('');

  // ==========================================================================
  // File to Base64 Conversion
  // ==========================================================================

  const file_to_base64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // ==========================================================================
  // Handle File Upload
  // ==========================================================================

  const handle_file = useCallback(async (file: File) => {
    // Validate file type
    if (file.type !== 'application/pdf') {
      set_error('Please upload a PDF document');
      return;
    }

    // Validate file size (max 20MB for PDFs)
    if (file.size > 20 * 1024 * 1024) {
      set_error('Document size must be less than 20MB');
      return;
    }

    try {
      const base64 = await file_to_base64(file);

      set_uploaded_document({
        file,
        base64,
        mime_type: file.type,
      });
      set_error(null);
    } catch (err) {
      set_error('Failed to process document');
    }
  }, []);

  // ==========================================================================
  // Drag and Drop Handlers
  // ==========================================================================

  const handle_drag_enter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    set_is_dragging(true);
  }, []);

  const handle_drag_leave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    set_is_dragging(false);
  }, []);

  const handle_drag_over = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handle_drop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    set_is_dragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handle_file(files[0]);
    }
  }, [handle_file]);

  // ==========================================================================
  // Handle File Input Change
  // ==========================================================================

  const handle_file_input_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handle_file(files[0]);
    }
  };

  // ==========================================================================
  // Remove Document
  // ==========================================================================

  const remove_document = () => {
    set_uploaded_document(null);
  };

  // ==========================================================================
  // Submit Prompt with Document
  // ==========================================================================

  const handle_submit = async (prompt_text: string) => {
    if (!prompt_text.trim() || !uploaded_document || loading) return;

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
          test_type: 'document_text',
          static_prompt: prompt_text,
          document_b64: uploaded_document.base64,
          document_mime_type: uploaded_document.mime_type,
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
  // Format file size
  // ==========================================================================

  const format_file_size = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <Layout sidebar={<Sidebar />}>
      <div className="cls_llm_test_document_container flex flex-col h-full p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="cls_llm_test_document_header mb-6">
          <h1 className="cls_llm_test_document_title text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Document → Text
          </h1>
          <p className="cls_llm_test_document_description text-muted-foreground text-sm">
            Upload a PDF document and get a text analysis from the LLM
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

        {/* Document Upload Area */}
        <div className="cls_document_upload_section mb-4">
          {!uploaded_document ? (
            <div
              className={`cls_dropzone border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                is_dragging
                  ? 'border-primary bg-primary/10'
                  : 'border-muted-foreground/30 hover:border-primary hover:bg-muted/50'
              }`}
              onDragEnter={handle_drag_enter}
              onDragLeave={handle_drag_leave}
              onDragOver={handle_drag_over}
              onDrop={handle_drop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handle_file_input_change}
              />
              <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">
                Drag and drop a PDF document here, or click to select
              </p>
              <p className="text-xs text-muted-foreground/70">
                Supports PDF (max 20MB)
              </p>
            </div>
          ) : (
            <div className="cls_document_preview border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-4">
                <div className="cls_document_icon flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <FileText className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <div className="cls_document_info flex-1">
                  <p className="font-medium truncate">{uploaded_document.file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {uploaded_document.mime_type} • {format_file_size(uploaded_document.file.size)}
                  </p>
                </div>
                <button
                  onClick={remove_document}
                  className="cls_remove_btn p-2 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Remove document"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Response Area */}
        <div className="cls_response_area flex-1 mb-4 min-h-[150px] p-4 border rounded-lg bg-muted/30 overflow-auto">
          {loading ? (
            <div className="cls_loading_state flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyzing document...</span>
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
            <div className="cls_empty_state text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Upload a document and submit to see the response...</span>
            </div>
          )}
        </div>

        {/* Prompt Input Area */}
        <PromptLibrarySelector
          api_endpoint="/api/prompts"
          on_submit={handle_submit}
          loading={loading}
          submit_button_text="Analyze"
          show_preview={true}
          free_input_placeholder="Enter your prompt for the document... (e.g., 'Summarize this document')"
          free_input_rows={2}
          default_free_input="Summarize the key points of this document."
        />
      </div>
    </Layout>
  );
}
