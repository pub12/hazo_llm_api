/**
 * LLM Selector Component
 * 
 * Reusable dropdown component for selecting LLM provider
 * Fetches enabled LLMs from config and defaults to primary_llm
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

// =============================================================================
// LLM Selector Component
// =============================================================================

interface LLMSelectorProps {
  value?: string;
  on_value_change: (value: string) => void;
  disabled?: boolean;
}

export function LLMSelector({ value, on_value_change, disabled = false }: LLMSelectorProps) {
  const [enabled_llms, set_enabled_llms] = useState<string[]>([]);
  const [primary_llm, set_primary_llm] = useState<string>('gemini');
  const [loading, set_loading] = useState(true);
  const [error, set_error] = useState<string | null>(null);

  // Fetch LLM config on mount
  useEffect(() => {
    const fetch_config = async () => {
      try {
        const res = await fetch('/api/llm-config');
        const data = await res.json();

        if (data.success) {
          set_enabled_llms(data.data.enabled_llms);
          set_primary_llm(data.data.primary_llm);
          
          // Set default value if not already set
          if (!value) {
            on_value_change(data.data.primary_llm);
          }
        } else {
          set_error(data.error || 'Failed to load LLM config');
          // Use defaults on error
          set_enabled_llms(['gemini']);
          set_primary_llm('gemini');
          if (!value) {
            on_value_change('gemini');
          }
        }
      } catch (err) {
        const error_message = err instanceof Error ? err.message : String(err);
        set_error(error_message);
        // Use defaults on error
        set_enabled_llms(['gemini']);
        set_primary_llm('gemini');
        if (!value) {
          on_value_change('gemini');
        }
      } finally {
        set_loading(false);
      }
    };

    fetch_config();
  }, [value, on_value_change]);

  // Format LLM name for display (capitalize first letter)
  const format_llm_name = (llm: string): string => {
    return llm.charAt(0).toUpperCase() + llm.slice(1);
  };

  if (loading) {
    return (
      <div className="cls_llm_selector_loading flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading LLMs...</span>
      </div>
    );
  }

  if (error) {
    console.error('LLM Selector error:', error);
  }

  if (enabled_llms.length === 0) {
    return (
      <div className="cls_llm_selector_error text-sm text-muted-foreground">
        No LLMs available
      </div>
    );
  }

  // If only one LLM is enabled, show it as read-only
  if (enabled_llms.length === 1) {
    return (
      <div className="cls_llm_selector_single flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">LLM:</span>
        <span className="font-medium">{format_llm_name(enabled_llms[0])}</span>
      </div>
    );
  }

  // Multiple LLMs - show dropdown
  return (
    <div className="cls_llm_selector_container flex items-center gap-2">
      <label htmlFor="llm-select" className="text-sm text-muted-foreground whitespace-nowrap">
        LLM:
      </label>
      <Select
        value={value || primary_llm}
        onValueChange={on_value_change}
        disabled={disabled}
      >
        <SelectTrigger id="llm-select" className="w-[140px]">
          <SelectValue placeholder="Select LLM" />
        </SelectTrigger>
        <SelectContent>
          {enabled_llms.map((llm) => (
            <SelectItem key={llm} value={llm}>
              {format_llm_name(llm)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}







