/**
 * Image + Image → Image Test Page
 * 
 * Test page for combining multiple images using hazo_llm_image_image.
 * Upload 2 images and provide a prompt to combine them.
 * API: hazo_llm_image_image
 */

'use client';

import { useState, useCallback } from 'react';
import { Layout } from 'hazo_llm_api';
import { Sidebar } from '@/components/sidebar';
import { ImageThumbnailer } from '@/components/image_thumbnailer';
import { LLMSelector } from '@/components/llm-selector';
import { Layers, Loader2, ImageIcon, Download, X, Upload } from 'lucide-react';

const API_NAME = 'hazo_llm_image_image';

// =============================================================================
// Types
// =============================================================================

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  base64: string;
  mime_type: string;
}

interface GeneratedImage {
  base64: string;
  mime_type: string;
}

// =============================================================================
// LLM Test Combine Images Page Component
// =============================================================================

export default function LLMTestCombineImagesPage() {
  const [prompt, set_prompt] = useState('Combine these two images into one cohesive creative image');
  const [uploaded_images, set_uploaded_images] = useState<UploadedImage[]>([]);
  const [generated_image, set_generated_image] = useState<GeneratedImage | null>(null);
  const [response_text, set_response_text] = useState('');
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [selected_llm, set_selected_llm] = useState<string>('');

  // ==========================================================================
  // Handle File Upload
  // ==========================================================================

  const handle_file_upload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const new_images: UploadedImage[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      if (uploaded_images.length + new_images.length >= 2) break;

      const base64 = await file_to_base64(file);
      new_images.push({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        base64: base64.split(',')[1], // Remove data:mime_type;base64, prefix
        mime_type: file.type,
      });
    }

    set_uploaded_images(prev => [...prev, ...new_images].slice(0, 2));
    // Reset file input
    e.target.value = '';
  }, [uploaded_images.length]);

  // ==========================================================================
  // Helper: Convert file to base64
  // ==========================================================================

  const file_to_base64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // ==========================================================================
  // Remove Image
  // ==========================================================================

  const remove_image = (id: string) => {
    set_uploaded_images(prev => {
      const updated = prev.filter(img => img.id !== id);
      // Revoke object URL to prevent memory leak
      const removed = prev.find(img => img.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return updated;
    });
  };

  // ==========================================================================
  // Handle Combine
  // ==========================================================================

  const handle_combine = async () => {
    if (uploaded_images.length < 2 || loading) return;

    set_loading(true);
    set_error(null);
    set_generated_image(null);
    set_response_text('');

    try {
      const res = await fetch('/api/test-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_type: 'combine_images',
          static_prompt: prompt,
          images: uploaded_images.map(img => ({
            data: img.base64,
            mime_type: img.mime_type,
          })),
          llm: selected_llm || undefined,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to combine images');
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
  // Download Image
  // ==========================================================================

  const handle_download = () => {
    if (!generated_image) return;

    const link = document.createElement('a');
    link.href = `data:${generated_image.mime_type};base64,${generated_image.base64}`;
    link.download = `combined-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <Layout sidebar={<Sidebar />}>
      <div className="cls_llm_test_combine_container flex flex-col h-full p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="cls_llm_test_combine_header mb-6">
          <h1 className="cls_llm_test_combine_title text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Image + Image → Image
          </h1>
          <p className="cls_llm_test_combine_description text-muted-foreground text-sm">
            Upload 2 images and provide a prompt to combine them into one
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
        <div className="cls_image_upload_section mb-6">
          <div className="flex gap-4 mb-4">
            {/* Image Slots */}
            {[0, 1].map((index) => {
              const image = uploaded_images[index];
              return (
                <div
                  key={index}
                  className="cls_image_slot relative w-40 h-40 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30 overflow-hidden"
                >
                  {image ? (
                    <>
                      <ImageThumbnailer
                        src={image.preview}
                        alt={`Image ${index + 1}`}
                        size="xl"
                        rounded={false}
                        bordered={false}
                        className="w-full h-full"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          remove_image(image.id);
                        }}
                        className="cls_remove_image_btn absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 z-10"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-50" />
                      <span className="text-xs">Image {index + 1}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Upload Button */}
            {uploaded_images.length < 2 && (
              <label className="cls_upload_btn w-40 h-40 border-2 border-dashed border-primary/50 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5 transition-colors">
                <Upload className="h-8 w-8 text-primary/70 mb-1" />
                <span className="text-xs text-primary/70">Add Image</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handle_file_upload}
                />
              </label>
            )}
          </div>
        </div>

        {/* Prompt Input */}
        <div className="cls_prompt_section mb-4">
          <label className="block text-sm font-medium mb-2">Combination Prompt</label>
          <textarea
            className="cls_prompt_input w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background"
            placeholder="Describe how you want the images combined..."
            value={prompt}
            onChange={(e) => set_prompt(e.target.value)}
            rows={2}
            disabled={loading}
          />
        </div>

        {/* Combine Button */}
        <button
          className="cls_combine_button mb-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          onClick={handle_combine}
          disabled={loading || uploaded_images.length < 2}
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Combining...</span>
            </>
          ) : (
            <>
              <Layers className="h-5 w-5" />
              <span>Combine Images</span>
            </>
          )}
        </button>

        {/* Output Area */}
        <div className="cls_output_area flex-1 min-h-[200px] p-4 border rounded-lg bg-muted/30 overflow-auto">
          {loading ? (
            <div className="cls_loading_state flex flex-col items-center justify-center h-full gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <span className="text-muted-foreground">Combining images...</span>
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
              <div className="cls_generated_image_wrapper relative inline-block">
                <ImageThumbnailer
                  src={`data:${generated_image.mime_type};base64,${generated_image.base64}`}
                  alt="Combined image"
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
          ) : response_text ? (
            <div className="cls_response_text_only">
              <p className="whitespace-pre-wrap">{response_text}</p>
            </div>
          ) : (
            <div className="cls_empty_state flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <Layers className="h-12 w-12 opacity-50" />
              <span>Upload 2 images and click combine to see the result</span>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

