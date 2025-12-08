/**
 * Image → Image Test Page
 * 
 * Test page for image-to-image transformation using hazo_llm_image_image.
 * Upload an image and provide a prompt to transform it.
 * API: hazo_llm_image_image
 */

'use client';

import { useState, useRef } from 'react';
import { Layout } from 'hazo_llm_api';
import { Sidebar } from '@/components/sidebar';
import { ImageThumbnailer } from '@/components/image_thumbnailer';
import { LLMSelector } from '@/components/llm-selector';
import { Wand2, Loader2, Download, Upload, Image as ImageIcon } from 'lucide-react';

const API_NAME = 'hazo_llm_image_image';

// =============================================================================
// Types
// =============================================================================

interface UploadedImage {
  preview: string;
  base64: string;
  mime_type: string;
}

interface GeneratedImage {
  base64: string;
  mime_type: string;
}

// =============================================================================
// Image → Image Test Page Component
// =============================================================================

export default function LLMTestImageImagePage() {
  const [uploaded_image, set_uploaded_image] = useState<UploadedImage | null>(null);
  const [prompt, set_prompt] = useState('Transform this image into a watercolor painting style');
  const [generated_image, set_generated_image] = useState<GeneratedImage | null>(null);
  const [response_text, set_response_text] = useState('');
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [selected_llm, set_selected_llm] = useState<string>('');
  const file_input_ref = useRef<HTMLInputElement>(null);

  // ==========================================================================
  // Handle File Upload
  // ==========================================================================

  const handle_file_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      set_error('Please upload an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      set_error('Image must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      set_uploaded_image({
        preview: URL.createObjectURL(file),
        base64: base64,
        mime_type: file.type,
      });
      set_error(null);
      set_generated_image(null);
      set_response_text('');
    };
    reader.readAsDataURL(file);
  };

  // ==========================================================================
  // Remove Uploaded Image
  // ==========================================================================

  const handle_remove_image = () => {
    if (uploaded_image) {
      URL.revokeObjectURL(uploaded_image.preview);
    }
    set_uploaded_image(null);
    set_generated_image(null);
    set_response_text('');
    set_error(null);
    if (file_input_ref.current) {
      file_input_ref.current.value = '';
    }
  };

  // ==========================================================================
  // Transform Image
  // ==========================================================================

  const handle_transform = async () => {
    if (!uploaded_image || !prompt.trim() || loading) return;

    set_loading(true);
    set_error(null);
    set_generated_image(null);
    set_response_text('');

    try {
      const res = await fetch('/api/test-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_type: 'transform_image',
          static_prompt: prompt,
          image_b64: uploaded_image.base64,
          image_mime_type: uploaded_image.mime_type,
          llm: selected_llm || undefined,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Transformation failed');
      }

      if (data.data?.image) {
        set_generated_image({
          base64: data.data.image.base64,
          mime_type: data.data.image.mime_type || 'image/png',
        });
      }

      if (data.data?.text) {
        set_response_text(data.data.text);
      }
    } catch (err) {
      const error_message = err instanceof Error ? err.message : String(err);
      set_error(error_message);
    } finally {
      set_loading(false);
    }
  };

  // ==========================================================================
  // Download Generated Image
  // ==========================================================================

  const handle_download = () => {
    if (!generated_image) return;

    const link = document.createElement('a');
    link.href = `data:${generated_image.mime_type};base64,${generated_image.base64}`;
    link.download = `transformed-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================================================
  // Handle Key Press
  // ==========================================================================

  const handle_key_press = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handle_transform();
    }
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <Layout sidebar={<Sidebar />}>
      <div className="cls_llm_test_image_image_container flex flex-col h-full p-6 max-w-4xl mx-auto overflow-auto">
        {/* Header */}
        <div className="cls_llm_test_image_image_header mb-6">
          <h1 className="cls_llm_test_image_image_title text-2xl font-bold flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-primary" />
            Image → Image
          </h1>
          <p className="cls_llm_test_image_image_description text-muted-foreground text-sm">
            Upload an image and provide a prompt to transform it
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

        {/* Image Upload Section */}
        <div className="cls_image_upload_section mb-4">
          <label className="block text-sm font-medium mb-2">Input Image</label>
          <input
            ref={file_input_ref}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handle_file_change}
            className="hidden"
          />
          
          {uploaded_image ? (
            <div className="cls_uploaded_image_preview flex items-start gap-4 p-4 border rounded-lg bg-muted/30">
              <div className="relative">
                <ImageThumbnailer
                  src={uploaded_image.preview}
                  alt="Uploaded image"
                  size="xl"
                />
                <button
                  className="cls_change_image_btn absolute bottom-1 right-1 p-1.5 bg-background/90 hover:bg-background rounded border text-xs z-10"
                  onClick={() => file_input_ref.current?.click()}
                  disabled={loading}
                  title="Change image"
                >
                  <Upload className="h-3 w-3" />
                </button>
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-2">Image uploaded</p>
                <button
                  className="text-xs text-destructive hover:underline"
                  onClick={handle_remove_image}
                  disabled={loading}
                >
                  Remove image
                </button>
              </div>
            </div>
          ) : (
            <button
              className="cls_upload_button w-full h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              onClick={() => file_input_ref.current?.click()}
              disabled={loading}
            >
              <ImageIcon className="h-10 w-10" />
              <span>Click to upload an image</span>
              <span className="text-xs">JPEG, PNG, GIF, WebP (max 10MB)</span>
            </button>
          )}
        </div>

        {/* Prompt Input */}
        <div className="cls_prompt_section mb-4">
          <label className="block text-sm font-medium mb-2">Transformation Prompt</label>
          <textarea
            className="cls_prompt_input w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background"
            placeholder="Describe how you want to transform the image... (Press Enter to submit)"
            value={prompt}
            onChange={(e) => set_prompt(e.target.value)}
            onKeyDown={handle_key_press}
            rows={2}
            disabled={loading}
          />
        </div>

        {/* Transform Button */}
        <button
          className="cls_transform_button mb-4 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
          onClick={handle_transform}
          disabled={loading || !uploaded_image || !prompt.trim()}
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Transforming...</span>
            </>
          ) : (
            <>
              <Wand2 className="h-5 w-5" />
              <span>Transform Image</span>
            </>
          )}
        </button>

        {/* Error Display */}
        {error && (
          <div className="cls_error_display mb-4 p-4 border border-destructive/50 rounded-lg bg-destructive/10 text-destructive">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Output Area */}
        <div className="cls_output_area flex-1 min-h-[250px] p-4 border rounded-lg bg-muted/30 overflow-auto">
          {loading ? (
            <div className="cls_loading_state flex flex-col items-center justify-center h-full gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <span className="text-muted-foreground">Transforming image...</span>
            </div>
          ) : generated_image ? (
            <div className="cls_result_content space-y-4">
              <p className="text-sm text-muted-foreground">Transformed Image (click to enlarge):</p>
              <div className="cls_generated_image_wrapper relative inline-block">
                <ImageThumbnailer
                  src={`data:${generated_image.mime_type};base64,${generated_image.base64}`}
                  alt="Transformed image"
                  size="auto"
                  className="shadow-lg"
                />
                <button
                  className="cls_download_btn absolute top-2 right-2 p-2 bg-background/80 hover:bg-background rounded-full shadow-md transition-colors z-10"
                  onClick={handle_download}
                  title="Download image"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>

              {/* Response Text */}
              {response_text && (
                <div className="cls_response_text p-3 bg-background rounded-lg border">
                  <p className="text-sm font-medium text-muted-foreground mb-1">AI Response:</p>
                  <p className="whitespace-pre-wrap">{response_text}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="cls_empty_state flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <Wand2 className="h-12 w-12 opacity-50" />
              <span>Upload an image and click &quot;Transform&quot; to see the result</span>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

