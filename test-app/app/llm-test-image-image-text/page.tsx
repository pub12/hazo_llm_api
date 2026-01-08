/**
 * Images → Image → Text Test Page
 * 
 * Test page for the chained function hazo_llm_image_image_text:
 * 1. hazo_llm_image_image: Combines first two images
 * 2. hazo_llm_image_image: Combines result + next image (repeat)
 * 3. hazo_llm_image_text: Describes the final image
 * 
 * Includes a log of all API calls with inputs and outputs.
 */

'use client';

import { useState, useRef } from 'react';
import { Layout } from 'hazo_llm_api';
import { Sidebar } from '@/components/sidebar';
import { ImageThumbnail } from '@/components/image_thumbnail';
import { LLMSelector } from '@/components/llm-selector';
import { Layers, Loader2, Plus, X, ArrowDown, Upload, Image as ImageIcon, ScrollText } from 'lucide-react';

const API_NAME = 'hazo_llm_image_image_text';

// =============================================================================
// Types
// =============================================================================

interface ImageItem {
  id: string;
  preview?: string;
  image_b64: string;
  image_mime_type: string;
}

interface GeneratedImage {
  base64: string;
  mime_type: string;
}

interface InterimImage {
  base64: string;
  mime_type: string;
  step: number;
}

interface ApiCallLog {
  step: number;
  api: string;
  input: string;
  output: string;
  status: 'pending' | 'running' | 'success' | 'error';
  timestamp?: string;
}

// =============================================================================
// Helper to generate unique ID
// =============================================================================

function generate_id(): string {
  return Math.random().toString(36).substring(2, 9);
}

// =============================================================================
// Image Upload Component
// =============================================================================

interface ImageUploadProps {
  image: ImageItem;
  label: string;
  on_update: (id: string, updates: Partial<ImageItem>) => void;
  disabled: boolean;
}

function ImageUpload({ image, label, on_update, disabled }: ImageUploadProps) {
  const file_input_ref = useRef<HTMLInputElement>(null);

  const handle_file_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File exceeds 10MB limit');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result?.toString().split(',')[1] || '';
      on_update(image.id, {
        preview: URL.createObjectURL(file),
        image_b64: base64,
        image_mime_type: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="cls_image_upload">
      <input
        ref={file_input_ref}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handle_file_change}
        className="hidden"
        disabled={disabled}
      />
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {image.preview ? (
        <div className="cls_image_preview_container">
          <ImageThumbnail
            src={image.preview}
            alt={label}
            size="md"
          />
          <button
            className="cls_change_image_btn mt-1 text-xs text-primary hover:underline flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              file_input_ref.current?.click();
            }}
            disabled={disabled}
          >
            <Upload className="h-3 w-3" />
            Change
          </button>
        </div>
      ) : (
        <button
          className="cls_upload_button w-24 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          onClick={() => file_input_ref.current?.click()}
          disabled={disabled}
        >
          <ImageIcon className="h-5 w-5" />
          <span className="text-xs">Add</span>
        </button>
      )}
    </div>
  );
}

// =============================================================================
// LLM Test Images → Image → Text Page Component
// =============================================================================

export default function LLMTestImageImageTextPage() {
  // State: images array (minimum 2)
  const [images, set_images] = useState<ImageItem[]>([
    { id: generate_id(), image_b64: '', image_mime_type: '' },
    { id: generate_id(), image_b64: '', image_mime_type: '' },
  ]);
  
  // State: prompts array (length = images.length - 1)
  const [prompts, set_prompts] = useState<string[]>(['']);
  
  const [description_prompt, set_description_prompt] = useState('Describe this final image in detail. What story does it tell?');
  const [generated_image, set_generated_image] = useState<GeneratedImage | null>(null);
  const [interim_images, set_interim_images] = useState<InterimImage[]>([]);
  const [description_text, set_description_text] = useState('');
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [current_step, set_current_step] = useState<number>(0);
  const [api_logs, set_api_logs] = useState<ApiCallLog[]>([]);
  const [selected_llm, set_selected_llm] = useState<string>('');

  // ==========================================================================
  // Add Image (and prompt)
  // ==========================================================================

  const handle_add_image = () => {
    set_images(prev => [
      ...prev,
      { id: generate_id(), image_b64: '', image_mime_type: '' },
    ]);
    set_prompts(prev => [...prev, '']);
  };

  // ==========================================================================
  // Remove Image (and corresponding prompt)
  // ==========================================================================

  const handle_remove_image = (index: number) => {
    if (images.length <= 2) return; // Minimum 2 images
    
    set_images(prev => prev.filter((_, i) => i !== index));
    
    // Remove corresponding prompt
    // If removing image at index i (i >= 1), remove prompt at index i-1
    // If removing image at index 0, remove prompt at index 0
    const prompt_index = index === 0 ? 0 : index - 1;
    set_prompts(prev => prev.filter((_, i) => i !== prompt_index));
    
    set_error(null);
  };

  // ==========================================================================
  // Update Image
  // ==========================================================================

  const handle_update_image = (id: string, updates: Partial<ImageItem>) => {
    set_images(prev =>
      prev.map(item => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  // ==========================================================================
  // Update Prompt
  // ==========================================================================

  const handle_update_prompt = (index: number, value: string) => {
    set_prompts(prev => prev.map((p, i) => (i === index ? value : p)));
  };

  // ==========================================================================
  // Run Chain
  // ==========================================================================

  const handle_run_chain = async () => {
    if (loading) return;

    // Validate all images have data
    const incomplete_image = images.find(img => !img.image_b64);
    if (incomplete_image) {
      set_error('All image slots must have an image');
      return;
    }

    // Validate all prompts are filled
    const empty_prompt = prompts.find(p => !p.trim());
    if (empty_prompt !== undefined) {
      set_error('All transformation prompts must be filled');
      return;
    }

    if (!description_prompt.trim()) {
      set_error('Description prompt is required');
      return;
    }

    set_loading(true);
    set_error(null);
    set_generated_image(null);
    set_interim_images([]);
    set_description_text('');
    set_current_step(1);

    // Build initial API logs
    const initial_logs: ApiCallLog[] = [];
    
    // Step 1: First combination
    initial_logs.push({
      step: 1,
      api: 'hazo_llm_image_image',
      input: `[Image 1] + [Image 2] + Prompt: "${prompts[0].substring(0, 50)}${prompts[0].length > 50 ? '...' : ''}"`,
      output: '',
      status: 'running',
      timestamp: new Date().toLocaleTimeString(),
    });
    
    // Additional image combination steps
    for (let i = 2; i < images.length; i++) {
      initial_logs.push({
        step: i,
        api: 'hazo_llm_image_image',
        input: `[Result ${i-1}] + [Image ${i+1}] + Prompt: "${prompts[i-1].substring(0, 50)}${prompts[i-1].length > 50 ? '...' : ''}"`,
        output: '',
        status: 'pending',
      });
    }
    
    // Final step: Description
    initial_logs.push({
      step: prompts.length + 1,
      api: 'hazo_llm_image_text',
      input: `[Final Image] + Prompt: "${description_prompt.substring(0, 50)}${description_prompt.length > 50 ? '...' : ''}"`,
      output: '',
      status: 'pending',
    });
    
    set_api_logs(initial_logs);

    try {
      const res = await fetch('/api/test-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_type: 'image_image_text',
          images: images.map(img => ({
            image_b64: img.image_b64,
            image_mime_type: img.image_mime_type,
          })),
          prompts: prompts,
          description_prompt: description_prompt,
          llm: selected_llm || undefined,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        // Mark current step as error
        set_api_logs(prev => prev.map((log, idx) => ({
          ...log,
          status: log.status === 'running' ? 'error' : log.status,
          output: log.status === 'running' ? `Error: ${data.error}` : log.output,
        })));
        throw new Error(data.error || 'Chain failed');
      }

      // Mark all steps as success
      set_api_logs(prev => prev.map((log, idx) => ({
        ...log,
        status: 'success' as const,
        output: idx < prev.length - 1 ? 'Generated intermediate image' : `Text: "${(data.data?.description_text || '').substring(0, 100)}${(data.data?.description_text || '').length > 100 ? '...' : ''}"`,
        timestamp: log.timestamp || new Date().toLocaleTimeString(),
      })));

      // Store interim images from each step
      if (data.data?.interim_images && Array.isArray(data.data.interim_images)) {
        set_interim_images(data.data.interim_images);
      }

      if (data.data?.image) {
        set_generated_image({
          base64: data.data.image.base64,
          mime_type: data.data.image.mime_type || 'image/png',
        });
      }

      if (data.data?.description_text) {
        set_description_text(data.data.description_text);
      }

      set_current_step(prompts.length + 1);
    } catch (err) {
      const error_message = err instanceof Error ? err.message : String(err);
      set_error(error_message);
      set_current_step(0);
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
    link.download = `chained-result-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================================================
  // Check if form is valid
  // ==========================================================================

  const is_valid =
    images.every(img => img.image_b64) &&
    prompts.every(p => p.trim()) &&
    description_prompt.trim();

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <Layout sidebar={<Sidebar />}>
      <div className="cls_llm_test_chain_container flex flex-col h-full p-6 max-w-4xl mx-auto overflow-auto">
        {/* Header */}
        <div className="cls_llm_test_chain_header mb-6">
          <h1 className="cls_llm_test_chain_title text-2xl font-bold flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Images → Image → Text
          </h1>
          <p className="cls_llm_test_chain_description text-muted-foreground text-sm">
            Chain: (Image1 + Image2 + Prompt1) → Result1 → (Result1 + Image3 + Prompt2) → ... → Final Description
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

          {/* Progress Indicator */}
          {loading && (
            <div className="cls_progress_indicator mt-4 flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                Processing step {current_step} of {prompts.length + 1}...
              </span>
            </div>
          )}
        </div>

        {/* Chain Steps */}
        <div className="cls_chain_steps space-y-4 mb-4">
          {/* Step 1: First two images */}
          <div className="cls_step_card border rounded-lg p-4 bg-background">
            <div className="cls_step_header flex items-center justify-between mb-3">
              <span className="cls_step_badge px-2 py-1 bg-primary/10 text-primary rounded text-sm font-medium">
                Step 1: Combine First Two Images
              </span>
            </div>
            
            <div className="cls_step_content flex gap-4 items-start">
              {/* Image 1 */}
              <ImageUpload
                image={images[0]}
                label="Image 1"
                on_update={handle_update_image}
                disabled={loading}
              />
              
              <span className="text-2xl text-muted-foreground self-center">+</span>
              
              {/* Image 2 */}
              <ImageUpload
                image={images[1]}
                label="Image 2"
                on_update={handle_update_image}
                disabled={loading}
              />
              
              {/* Prompt 1 */}
              <div className="cls_prompt_section flex-1">
                <label className="block text-xs text-muted-foreground mb-1">
                  Prompt 1: How to combine
                </label>
                <textarea
                  className="cls_prompt_input w-full p-3 border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-primary bg-background text-sm min-h-[120px]"
                  placeholder="Describe how to combine these two images..."
                  value={prompts[0]}
                  onChange={(e) => handle_update_prompt(0, e.target.value)}
                  rows={6}
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Additional Steps */}
          {images.slice(2).map((image, idx) => {
            const image_index = idx + 2;
            const prompt_index = idx + 1;
            
            return (
              <div key={image.id}>
                <div className="flex justify-center mb-2">
                  <ArrowDown className="h-5 w-5 text-muted-foreground" />
                </div>
                
                <div className="cls_step_card border rounded-lg p-4 bg-background">
                  <div className="cls_step_header flex items-center justify-between mb-3">
                    <span className="cls_step_badge px-2 py-1 bg-primary/10 text-primary rounded text-sm font-medium">
                      Step {prompt_index + 1}: Add Image {image_index + 1}
                    </span>
                    <button
                      className="cls_remove_btn p-1 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => handle_remove_image(image_index)}
                      disabled={loading}
                      title="Remove this step"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="cls_step_content flex gap-4 items-start">
                    <div className="cls_result_placeholder w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground bg-muted/30">
                      <span className="text-xs text-center px-1">Result from Step {prompt_index}</span>
                    </div>
                    
                    <span className="text-2xl text-muted-foreground self-center">+</span>
                    
                    <ImageUpload
                      image={image}
                      label={`Image ${image_index + 1}`}
                      on_update={handle_update_image}
                      disabled={loading}
                    />
                    
                    <div className="cls_prompt_section flex-1">
                      <label className="block text-xs text-muted-foreground mb-1">
                        Prompt {prompt_index + 1}: How to combine
                      </label>
                      <textarea
                        className="cls_prompt_input w-full p-3 border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-primary bg-background text-sm min-h-[120px]"
                        placeholder="Describe how to combine with previous result..."
                        value={prompts[prompt_index]}
                        onChange={(e) => handle_update_prompt(prompt_index, e.target.value)}
                        rows={6}
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Image Step Button */}
        <button
          className="cls_add_step_button mb-4 px-4 py-3 border-2 border-dashed rounded-lg flex items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          onClick={handle_add_image}
          disabled={loading}
        >
          <Plus className="h-5 w-5" />
          <span>Add Another Image Step</span>
        </button>

        {/* Final Description Prompt */}
        <div className="cls_description_section border rounded-lg p-4 bg-muted/30 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDown className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Final Step: Describe Result</span>
          </div>
          <textarea
            className="cls_description_input w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background"
            placeholder="Enter a prompt to describe the final result..."
            value={description_prompt}
            onChange={(e) => set_description_prompt(e.target.value)}
            rows={2}
            disabled={loading}
          />
        </div>

        {/* Run Button */}
        <button
          className="cls_run_button mb-4 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
          onClick={handle_run_chain}
          disabled={loading || !is_valid}
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Processing Chain...</span>
            </>
          ) : (
            <>
              <Layers className="h-5 w-5" />
              <span>Run {prompts.length}-Step Chain</span>
            </>
          )}
        </button>

        {/* API Call Logs */}
        {api_logs.length > 0 && (
          <div className="cls_api_logs mb-4 border rounded-lg bg-muted/20 overflow-hidden">
            <div className="cls_api_logs_header px-4 py-2 bg-muted/50 border-b flex items-center gap-2">
              <ScrollText className="h-4 w-4" />
              <span className="font-medium text-sm">API Call Log</span>
            </div>
            <div className="cls_api_logs_content p-2 space-y-2 max-h-[250px] overflow-auto">
              {api_logs.map((log, idx) => (
                <div 
                  key={idx} 
                  className={`cls_api_log_entry p-2 rounded text-xs font-mono ${
                    log.status === 'running' ? 'bg-blue-500/10 border border-blue-500/30' :
                    log.status === 'success' ? 'bg-green-500/10 border border-green-500/30' :
                    log.status === 'error' ? 'bg-red-500/10 border border-red-500/30' :
                    'bg-muted/30 border border-muted'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      log.status === 'running' ? 'bg-blue-500 text-white' :
                      log.status === 'success' ? 'bg-green-500 text-white' :
                      log.status === 'error' ? 'bg-red-500 text-white' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      Step {log.step}
                    </span>
                    <span className="font-semibold">{log.api}</span>
                    {log.timestamp && <span className="text-muted-foreground ml-auto">{log.timestamp}</span>}
                  </div>
                  <div className="text-muted-foreground">
                    <span className="text-foreground/70">Input:</span> {log.input}
                  </div>
                  {log.output && (
                    <div className="text-muted-foreground">
                      <span className="text-foreground/70">Output:</span> {log.output}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="cls_error_display mb-4 p-4 border border-destructive/50 rounded-lg bg-destructive/10 text-destructive">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Results */}
        {(generated_image || description_text || interim_images.length > 0) && (
          <div className="cls_results_area border rounded-lg p-4 bg-muted/30">
            <h3 className="text-lg font-medium mb-4">Results</h3>

            {/* Interim Images - Step by Step */}
            {interim_images.length > 0 && (
              <div className="cls_interim_images_section mb-6">
                <p className="text-sm text-muted-foreground mb-3">Step-by-Step Results (click to enlarge):</p>
                <div className="cls_interim_images_grid flex flex-wrap gap-4">
                  {interim_images.map((img, idx) => (
                    <div key={idx} className="cls_interim_image_card border rounded-lg p-3 bg-background">
                      <div className="cls_interim_image_header mb-2">
                        <span className="cls_step_badge px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                          Step {img.step} Result
                        </span>
                      </div>
                      <ImageThumbnail
                        src={`data:${img.mime_type};base64,${img.base64}`}
                        alt={`Step ${img.step} result`}
                        size="md"
                        className="shadow"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Final Generated Image */}
            {generated_image && (
              <div className="cls_result_image_section mb-4">
                <p className="text-sm text-muted-foreground mb-2">Final Image (click to enlarge):</p>
                <ImageThumbnail
                  src={`data:${generated_image.mime_type};base64,${generated_image.base64}`}
                  alt="Chained result"
                  size="auto"
                  className="shadow-lg"
                  on_download={handle_download}
                />
              </div>
            )}

            {/* Description Text */}
            {description_text && (
              <div className="cls_description_result_section">
                <p className="text-sm text-muted-foreground mb-2">Description:</p>
                <div className="cls_description_text p-3 bg-background rounded-lg border">
                  <p className="whitespace-pre-wrap">{description_text}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
