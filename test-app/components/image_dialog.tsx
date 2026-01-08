/**
 * Image Dialog Component
 *
 * A reusable dialog component for displaying images in an enlarged view with zoom controls.
 * Extracted from ImageThumbnailer for standalone use.
 */

'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

// =============================================================================
// Types
// =============================================================================

interface ImageDialogProps {
  /** Image source (base64 data URL or blob URL) */
  src: string;

  /** Alt text for the image */
  alt: string;

  /** Whether the dialog is open */
  is_open: boolean;

  /** Callback when the dialog should close */
  on_close: () => void;
}

// =============================================================================
// Image Dialog Component
// =============================================================================

export function ImageDialog({
  src,
  alt,
  is_open,
  on_close,
}: ImageDialogProps) {
  const [zoom_level, set_zoom_level] = useState(1);

  // Min and max zoom levels
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3;
  const ZOOM_STEP = 0.25;

  // Reset zoom when dialog opens
  useEffect(() => {
    if (is_open) {
      set_zoom_level(1);
    }
  }, [is_open]);

  // ==========================================================================
  // Zoom Handlers
  // ==========================================================================

  const handle_zoom_in = () => {
    set_zoom_level(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  };

  const handle_zoom_out = () => {
    set_zoom_level(prev => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  };

  const handle_reset_zoom = () => {
    set_zoom_level(1);
  };

  const handle_close = () => {
    set_zoom_level(1);
    on_close();
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <Dialog open={is_open} onOpenChange={handle_close}>
      <DialogContent className="cls_image_dialog max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>{alt}</DialogTitle>
        </VisuallyHidden>

        {/* Zoom Controls */}
        <div className="cls_zoom_controls absolute top-2 right-10 z-10 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-lg p-1 shadow-md">
          <button
            className="cls_zoom_btn p-2 hover:bg-muted rounded transition-colors disabled:opacity-50"
            onClick={handle_zoom_out}
            disabled={zoom_level <= MIN_ZOOM}
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          <span className="cls_zoom_level px-2 text-sm font-medium min-w-[3rem] text-center">
            {Math.round(zoom_level * 100)}%
          </span>

          <button
            className="cls_zoom_btn p-2 hover:bg-muted rounded transition-colors disabled:opacity-50"
            onClick={handle_zoom_in}
            disabled={zoom_level >= MAX_ZOOM}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          <button
            className="cls_zoom_btn p-2 hover:bg-muted rounded transition-colors"
            onClick={handle_reset_zoom}
            title="Reset zoom"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* Image Container with scroll */}
        <div className="cls_image_container overflow-auto max-h-[85vh] p-4 flex items-center justify-center bg-muted/30">
          <img
            src={src}
            alt={alt}
            className="cls_zoomed_image transition-transform duration-200"
            style={{
              transform: `scale(${zoom_level})`,
              transformOrigin: 'center center',
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ImageDialog;
