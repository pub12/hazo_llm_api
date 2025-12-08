/**
 * Image Thumbnailer Component
 * 
 * A reusable component that displays an image thumbnail.
 * When clicked, opens a Shadcn dialog with a larger view and zoom controls.
 */

'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

// =============================================================================
// Types
// =============================================================================

interface ImageThumbnailerProps {
  /** Image source (base64 data URL or blob URL) */
  src: string;
  
  /** Alt text for the image */
  alt: string;
  
  /** Additional CSS classes for the thumbnail container */
  className?: string;
  
  /** Thumbnail size (default: 'md') */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'auto';
  
  /** Whether to show rounded corners (default: true) */
  rounded?: boolean;
  
  /** Whether to show border (default: true) */
  bordered?: boolean;
}

// =============================================================================
// Size Classes
// =============================================================================

const SIZE_CLASSES = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
  xl: 'w-48 h-48',
  auto: 'max-w-full max-h-[400px]',
};

// =============================================================================
// Image Thumbnailer Component
// =============================================================================

export function ImageThumbnailer({
  src,
  alt,
  className = '',
  size = 'md',
  rounded = true,
  bordered = true,
}: ImageThumbnailerProps) {
  const [is_open, set_is_open] = useState(false);
  const [zoom_level, set_zoom_level] = useState(1);
  
  // Min and max zoom levels
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3;
  const ZOOM_STEP = 0.25;

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

  const handle_open = () => {
    set_is_open(true);
    set_zoom_level(1); // Reset zoom when opening
  };

  const handle_close = () => {
    set_is_open(false);
    set_zoom_level(1);
  };

  // ==========================================================================
  // Build thumbnail classes
  // ==========================================================================

  const size_class = SIZE_CLASSES[size];
  const thumbnail_classes = [
    'cls_image_thumbnailer',
    'object-cover',
    'cursor-pointer',
    'transition-transform',
    'hover:scale-105',
    size_class,
    rounded ? 'rounded-lg' : '',
    bordered ? 'border' : '',
    className,
  ].filter(Boolean).join(' ');

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <>
      {/* Thumbnail */}
      <img
        src={src}
        alt={alt}
        className={thumbnail_classes}
        onClick={handle_open}
        title="Click to enlarge"
      />

      {/* Dialog with larger image and zoom controls */}
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
    </>
  );
}

export default ImageThumbnailer;

