/**
 * Text → Image Test Page
 * 
 * Test page for text-to-image LLM calls using hazo_llm_text_image.
 * Generate images from text prompts.
 * API: hazo_llm_text_image
 */

'use client';

import { useState } from 'react';
import { Layout } from 'hazo_llm_api';
import { Sidebar } from '@/components/sidebar';
import { ImageThumbnail } from '@/components/image_thumbnail';
import { LLMSelector } from '@/components/llm-selector';
import { Sparkles, Loader2, ImageIcon } from 'lucide-react';

const API_NAME = 'hazo_llm_text_image';

// =============================================================================
// Types
// =============================================================================

interface GeneratedImage {
  base64: string;
  mime_type: string;
}

// =============================================================================
// LLM Test Image Generation Page Component
// =============================================================================

export default function LLMTestImageGenPage() {
  const [prompt, set_prompt] = useState('');
  const [generated_image, set_generated_image] = useState<GeneratedImage | null>(null);
  const [response_text, set_response_text] = useState('');
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [selected_llm, set_selected_llm] = useState<string>('');

  // ==========================================================================
  // Generate Image
  // ==========================================================================

  const handle_generate = async () => {
    if (!prompt.trim() || loading) return;

    set_loading(true);
    set_error(null);
    set_generated_image(null);
    set_response_text('');

    try {
      const res = await fetch('/api/test-llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_type: 'generate_image',
          static_prompt: prompt,
          llm: selected_llm || undefined,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate image');
      }

      // Extract image and text from response
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
  // Download Image
  // ==========================================================================

  const handle_download = () => {
    if (!generated_image) return;

    const link = document.createElement('a');
    link.href = `data:${generated_image.mime_type};base64,${generated_image.base64}`;
    link.download = `generated-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================================================
  // Handle Key Press (Enter to submit)
  // ==========================================================================

  const handle_key_press = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handle_generate();
    }
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <Layout sidebar={<Sidebar />}>
      <div className="cls_llm_test_image_gen_container flex flex-col h-full p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="cls_llm_test_image_gen_header mb-6">
          <h1 className="cls_llm_test_image_gen_title text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Text → Image
          </h1>
          <p className="cls_llm_test_image_gen_description text-muted-foreground text-sm">
            Enter a text prompt to generate an image using AI
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

        {/* Output Area */}
        <div className="cls_output_area flex-1 mb-4 min-h-[300px] p-4 border rounded-lg bg-muted/30 overflow-auto">
          {loading ? (
            <div className="cls_loading_state flex flex-col items-center justify-center h-full gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <span className="text-muted-foreground">Generating image...</span>
            </div>
          ) : error ? (
            <div className="cls_error_state text-red-500">
              <p className="font-medium">Error:</p>
              <p>{error}</p>
            </div>
          ) : generated_image ? (
            <div className="cls_generated_content space-y-4">
              {/* Generated Image */}
              <p className="text-sm text-muted-foreground">Click image to enlarge:</p>
              <ImageThumbnail
                src={`data:${generated_image.mime_type};base64,${generated_image.base64}`}
                alt="Generated image"
                size="auto"
                className="shadow-lg"
                on_download={handle_download}
              />

              {/* Response Text (if any) */}
              {response_text && (
                <div className="cls_response_text p-3 bg-background rounded-lg border">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Additional Response:</p>
                  <p className="whitespace-pre-wrap">{response_text}</p>
                </div>
              )}
            </div>
          ) : response_text ? (
            <div className="cls_generated_content">
              <div className="cls_response_text prose prose-sm dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap">{response_text}</p>
              </div>
            </div>
          ) : (
            <div className="cls_empty_state flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <ImageIcon className="h-12 w-12 opacity-50" />
              <span>Your generated image will appear here</span>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="cls_input_area flex gap-2">
          <textarea
            className="cls_prompt_input flex-1 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background"
            placeholder="Describe the image you want to generate... (Press Enter to submit)"
            value={prompt}
            onChange={(e) => set_prompt(e.target.value)}
            onKeyDown={handle_key_press}
            rows={2}
            disabled={loading}
          />
          <button
            className="cls_generate_button px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed self-end flex items-center gap-2"
            onClick={handle_generate}
            disabled={loading || !prompt.trim()}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                <span className="hidden sm:inline">Generate</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Layout>
  );
}

