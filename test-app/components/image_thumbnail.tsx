/**
 * Image Thumbnail Component
 *
 * A reusable component that displays an image thumbnail with:
 * - Auto-detected dimensions shown below as "w x h"
 * - Optional remove button (red X) for input images
 * - Optional download button for output images
 * - Click to open enlarged view in ImageDialog
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { ImageDialog } from './image_dialog';

// =============================================================================
// Types
// =============================================================================

interface ImageThumbnailProps {
  /** Image source (base64 data URL or blob URL) */
  src: string;

  /** Alt text for the image */
  alt: string;

  /** Thumbnail size (default: 'md') */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'auto';

  /** Whether to show dimensions below the image (default: true) */
  show_dimensions?: boolean;

  /** Callback when remove button is clicked (shows X button when provided) */
  on_remove?: () => void;

  /** Callback when download button is clicked (shows download button when provided) */
  on_download?: () => void;

  /** Additional CSS classes for the container */
  className?: string;

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
// Image Thumbnail Component
// =============================================================================

export function ImageThumbnail({
  src,
  alt,
  size = 'md',
  show_dimensions = true,
  on_remove,
  on_download,
  className = '',
  rounded = true,
  bordered = true,
}: ImageThumbnailProps) {
  const [is_dialog_open, set_is_dialog_open] = useState(false);
  const [dimensions, set_dimensions] = useState<{ width: number; height: number } | null>(null);

  // ==========================================================================
  // Load image dimensions
  // ==========================================================================

  useEffect(() => {
    if (!src) return;

    const img = new Image();
    img.onload = () => {
      set_dimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = src;
  }, [src]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handle_thumbnail_click = () => {
    set_is_dialog_open(true);
  };

  const handle_remove_click = (e: React.MouseEvent) => {
    e.stopPropagation();
    on_remove?.();
  };

  const handle_download_click = (e: React.MouseEvent) => {
    e.stopPropagation();
    on_download?.();
  };

  // ==========================================================================
  // Build classes
  // ==========================================================================

  const size_class = SIZE_CLASSES[size];
  const image_classes = [
    'cls_image_thumbnail_img',
    'object-cover',
    'cursor-pointer',
    'transition-transform',
    'hover:scale-105',
    size_class,
    rounded ? 'rounded-lg' : '',
    bordered ? 'border' : '',
  ].filter(Boolean).join(' ');

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className={`cls_image_thumbnail inline-flex flex-col items-center ${className}`}>
      {/* Image container with overlay buttons */}
      <div className="cls_image_thumbnail_wrapper relative">
        <img
          src={src}
          alt={alt}
          className={image_classes}
          onClick={handle_thumbnail_click}
          title="Click to enlarge"
        />

        {/* Remove button (red X) */}
        {on_remove && (
          <button
            className="cls_remove_btn absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 z-10 transition-colors"
            onClick={handle_remove_click}
            title="Remove image"
          >
            <X className="h-3 w-3" />
          </button>
        )}

        {/* Download button */}
        {on_download && (
          <button
            className="cls_download_btn absolute top-2 right-2 p-2 bg-background/80 hover:bg-background rounded-full shadow-md transition-colors z-10"
            onClick={handle_download_click}
            title="Download image"
          >
            <Download className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dimensions display */}
      {show_dimensions && dimensions && (
        <span className="cls_image_dimensions text-xs text-muted-foreground mt-1">
          {dimensions.width} x {dimensions.height}
        </span>
      )}

      {/* Dialog for enlarged view */}
      <ImageDialog
        src={src}
        alt={alt}
        is_open={is_dialog_open}
        on_close={() => set_is_dialog_open(false)}
      />
    </div>
  );
}

export default ImageThumbnail;
