/**
 * Text → Image → Text Test Page
 * 
 * Test page for the chained function hazo_llm_text_image_text:
 * 1. hazo_llm_text_image: Generates an image from prompt_image
 * 2. hazo_llm_image_text: Analyzes the generated image with prompt_text
 * 
 * Includes a log of all API calls with inputs and outputs.
 */

'use client';

import { useState } from 'react';
import { Layout } from 'hazo_llm_api';
import { Sidebar } from '@/components/sidebar';
import { ImageThumbnail } from '@/components/image_thumbnail';
import { LLMSelector } from '@/components/llm-selector';
import { Workflow, Loader2, ImageIcon, ArrowRight, ScrollText } from 'lucide-react';

const API_NAME = 'hazo_llm_text_image_text';

// =============================================================================
// Types
// =============================================================================

interface GeneratedImage {
  base64: string;
  mime_type: string;
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
// LLM Test Text → Image → Text Page Component
// =============================================================================

export default function LLMTestTextImageTextPage() {
  const [prompt_image, set_prompt_image] = useState('A vibrant futuristic cityscape at sunset with flying cars');
  const [prompt_text, set_prompt_text] = useState('Describe this image in detail. What do you see? What mood does it convey?');
  const [generated_image, set_generated_image] = useState<GeneratedImage | null>(null);
  const [analysis_text, set_analysis_text] = useState('');
  const [loading, set_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const [current_step, set_current_step] = useState<'idle' | 'generating' | 'analyzing' | 'done'>('idle');
  const [api_logs, set_api_logs] = useState<ApiCallLog[]>([]);
  const [selected_llm, set_selected_llm] = useState<string>('');

  // ==========================================================================
  // Handle Run Chain
  // ==========================================================================

  const handle_run_chain = async () => {
    if (!prompt_image.trim() || !prompt_text.trim() || loading) return;

    set_loading(true);
    set_error(null);
    set_generated_image(null);
    set_analysis_text('');
    set_current_step('generating');
    
    // Initialize API logs
    const initial_logs: ApiCallLog[] = [
      {
        step: 1,
        api: 'hazo_llm_text_image',
        input: `Prompt: "${prompt_image.substring(0, 100)}${prompt_image.length > 100 ? '...' : ''}"`,
        output: '',
        status: 'running',
        timestamp: new Date().toLocaleTimeString(),
      },
      {
        step: 2,
        api: 'hazo_llm_image_text',
        input: `Prompt: "${prompt_text.substring(0, 100)}${prompt_text.length > 100 ? '...' : ''}" + [Generated Image]`,
        output: '',
        status: 'pending',
      },
    ];
    set_api_logs(initial_logs);

    try {
      const res = await fetch('/api/test-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_type: 'text_image_text',
          prompt_image: prompt_image,
          prompt_text: prompt_text,
          llm: selected_llm || undefined,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        // Update logs with error
        set_api_logs(prev => prev.map((log, idx) => ({
          ...log,
          status: idx === 0 ? 'error' : 'pending',
          output: idx === 0 ? `Error: ${data.error}` : '',
        })));
        throw new Error(data.error || 'Chain failed');
      }

      // Update step 1 as success
      set_api_logs(prev => prev.map((log, idx) => 
        idx === 0 
          ? { ...log, status: 'success' as const, output: 'Generated image successfully' }
          : { ...log, status: 'running' as const, timestamp: new Date().toLocaleTimeString() }
      ));
      
      set_current_step('analyzing');

      if (data.data?.image) {
        set_generated_image({
          base64: data.data.image.base64,
          mime_type: data.data.image.mime_type || 'image/png',
        });
      }

      if (data.data?.analysis_text) {
        set_analysis_text(data.data.analysis_text);
      }

      // Update step 2 as success
      set_api_logs(prev => prev.map((log, idx) => 
        idx === 1 
          ? { 
              ...log, 
              status: 'success' as const, 
              output: `Text response: "${(data.data?.analysis_text || '').substring(0, 150)}${(data.data?.analysis_text || '').length > 150 ? '...' : ''}"` 
            }
          : log
      ));

      set_current_step('done');
    } catch (err) {
      const error_message = err instanceof Error ? err.message : String(err);
      set_error(error_message);
      set_current_step('idle');
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
  // Render
  // ==========================================================================

  return (
    <Layout sidebar={<Sidebar />}>
      <div className="cls_llm_test_chain_container flex flex-col h-full p-6 max-w-4xl mx-auto overflow-auto">
        {/* Header */}
        <div className="cls_llm_test_chain_header mb-6">
          <h1 className="cls_llm_test_chain_title text-2xl font-bold flex items-center gap-2">
            <Workflow className="h-6 w-6 text-primary" />
            Text → Image → Text
          </h1>
          <p className="cls_llm_test_chain_description text-muted-foreground text-sm">
            Generate an image from a prompt, then analyze it with a second prompt
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
          
          {/* Flow Indicator */}
          <div className="cls_flow_indicator mt-4 flex items-center gap-2 text-sm flex-wrap">
            <span className={`px-2 py-1 rounded ${current_step === 'generating' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              1. hazo_llm_text_image
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className={`px-2 py-1 rounded ${current_step === 'analyzing' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              2. hazo_llm_image_text
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className={`px-2 py-1 rounded ${current_step === 'done' ? 'bg-green-500 text-white' : 'bg-muted'}`}>
              Result
            </span>
          </div>
        </div>

        {/* Prompt Inputs */}
        <div className="cls_prompts_section grid gap-4 mb-4">
          {/* Prompt 1: Image Generation */}
          <div className="cls_prompt_image_section">
            <label className="block text-sm font-medium mb-2">
              Prompt 1: Image Generation (hazo_llm_text_image)
            </label>
            <textarea
              className="cls_prompt_input w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              placeholder="Describe the image you want to generate..."
              value={prompt_image}
              onChange={(e) => set_prompt_image(e.target.value)}
              rows={2}
              disabled={loading}
            />
          </div>
          
          {/* Prompt 2: Image Analysis */}
          <div className="cls_prompt_text_section">
            <label className="block text-sm font-medium mb-2">
              Prompt 2: Image Analysis (hazo_llm_image_text)
            </label>
            <textarea
              className="cls_prompt_input w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              placeholder="What do you want to know about the generated image?"
              value={prompt_text}
              onChange={(e) => set_prompt_text(e.target.value)}
              rows={2}
              disabled={loading}
            />
          </div>
        </div>

        {/* Run Button */}
        <button
          className="cls_run_button mb-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          onClick={handle_run_chain}
          disabled={loading || !prompt_image.trim() || !prompt_text.trim()}
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{current_step === 'generating' ? 'Generating Image...' : 'Analyzing...'}</span>
            </>
          ) : (
            <>
              <Workflow className="h-5 w-5" />
              <span>Run Chain</span>
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
            <div className="cls_api_logs_content p-2 space-y-2 max-h-[200px] overflow-auto">
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

        {/* Output Area */}
        <div className="cls_output_area flex-1 min-h-[250px] p-4 border rounded-lg bg-muted/30 overflow-auto">
          {loading ? (
            <div className="cls_loading_state flex flex-col items-center justify-center h-full gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <span className="text-muted-foreground">
                {current_step === 'generating' ? 'Generating image...' : 'Analyzing image...'}
              </span>
            </div>
          ) : error ? (
            <div className="cls_error_state text-red-500">
              <p className="font-medium">Error:</p>
              <p>{error}</p>
            </div>
          ) : generated_image || analysis_text ? (
            <div className="cls_results space-y-4">
              {/* Generated Image */}
              {generated_image && (
                <div className="cls_generated_image_section">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Generated Image (click to enlarge):</h3>
                  <ImageThumbnail
                    src={`data:${generated_image.mime_type};base64,${generated_image.base64}`}
                    alt="Generated image"
                    size="auto"
                    className="shadow-lg max-h-[300px]"
                    on_download={handle_download}
                  />
                </div>
              )}

              {/* Analysis Text */}
              {analysis_text && (
                <div className="cls_analysis_section">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Image Analysis:</h3>
                  <div className="cls_analysis_text p-3 bg-background rounded-lg border">
                    <p className="whitespace-pre-wrap">{analysis_text}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="cls_empty_state flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <ImageIcon className="h-12 w-12 opacity-50" />
              <span>Enter prompts and click &quot;Run Chain&quot; to see results</span>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
