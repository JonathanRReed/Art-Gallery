import React, { useRef, useEffect, useState, useCallback, forwardRef } from 'react';

const MAX_SAFE_SIZE = 2048;

function formatDimension(n) {
  return `${n.toLocaleString()} × ${n.toLocaleString()}`;
}

function drawPlaceholder(ctx, w, h, imgWidth, imgHeight) {
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, '#1b2234');
  gradient.addColorStop(0.5, '#5567ff');
  gradient.addColorStop(1, '#111827');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#eef2ff';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✓', w / 2, h / 2 - 20);

  ctx.fillStyle = '#f6f7fb';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('AllRGB Complete!', w / 2, h / 2 + 20);

  ctx.fillStyle = '#d9e1ff';
  ctx.font = '14px sans-serif';
  ctx.fillText(`${formatDimension(imgWidth)} pixels`, w / 2, h / 2 + 45);
  ctx.fillText('Click "Download PNG" to save', w / 2, h / 2 + 70);
}

function drawDownsampledThumbnail(ctx, imageData, srcW, srcH, dstW, dstH) {
  try {
    const scale = Math.min(dstW / srcW, dstH / srcH);
    const thumbW = Math.max(1, Math.floor(srcW * scale));
    const thumbH = Math.max(1, Math.floor(srcH * scale));

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = srcW;
    tmpCanvas.height = srcH;
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.putImageData(new ImageData(imageData, srcW, srcH), 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, dstW, dstH);
    ctx.fillStyle = 'var(--color-paper-alt)';
    ctx.fillRect(0, 0, dstW, dstH);
    const offsetX = (dstW - thumbW) / 2;
    const offsetY = (dstH - thumbH) / 2;
    ctx.drawImage(tmpCanvas, offsetX, offsetY, thumbW, thumbH);
  } catch {
    // Fallback to placeholder on any error
    drawPlaceholder(ctx, dstW, dstH, srcW, srcH);
  }
}

const PreviewCanvas = forwardRef(function PreviewCanvas({
  imageData,
  loading,
  width = 512,
  height = 512,
  canvasRef,
  metadata = null
}, ref) {
  const localRef = useRef(null);
  const actualRef = canvasRef || ref || localRef;
  const wrapperRef = useRef(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  const hasImage = imageData instanceof Uint8ClampedArray;

  useEffect(() => {
    const canvas = actualRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) {
      console.error('Failed to get 2D context from canvas');
      return;
    }

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    if (hasImage) {
      try {
        const imgWidth = metadata?.width || width;
        const imgHeight = metadata?.height || height;
        const pixelCount = imageData.length / 4;

        if (pixelCount === imgWidth * imgHeight) {
          if (imgWidth > MAX_SAFE_SIZE || imgHeight > MAX_SAFE_SIZE) {
            // Large image: draw a downsampled thumbnail instead of crashing
            drawDownsampledThumbnail(ctx, imageData, imgWidth, imgHeight, width, height);
          } else if (imgWidth === width && imgHeight === height) {
            ctx.putImageData(new ImageData(imageData, imgWidth, imgHeight), 0, 0);
          } else {
            ctx.clearRect(0, 0, width, height);
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = imgWidth;
            tmpCanvas.height = imgHeight;
            const tmpCtx = tmpCanvas.getContext('2d');
            tmpCtx.putImageData(new ImageData(imageData, imgWidth, imgHeight), 0, 0);
            ctx.drawImage(tmpCanvas, 0, 0, width, height);
          }
        } else {
          const imgSize = Math.sqrt(pixelCount);
          if (Math.floor(imgSize) === imgSize) {
            ctx.clearRect(0, 0, width, height);
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = imgSize;
            tmpCanvas.height = imgSize;
            const tmpCtx = tmpCanvas.getContext('2d');
            tmpCtx.putImageData(new ImageData(imageData, imgSize, imgSize), 0, 0);
            ctx.drawImage(tmpCanvas, 0, 0, width, height);
          } else {
            console.error(`Invalid image data size: ${imageData.length} bytes doesn't match any expected dimensions`);
            ctx.clearRect(0, 0, width, height);
          }
        }
      } catch (err) {
        console.error("Error rendering preview:", err);
        ctx.clearRect(0, 0, width, height);
      }
    } else {
      ctx.clearRect(0, 0, width, height);
    }
  }, [imageData, width, height, actualRef, metadata, hasImage]);

  const handleWheel = useCallback((e) => {
    if (!hasImage) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => {
      const next = Math.min(Math.max(z + delta, 1), 4);
      return next;
    });
  }, [hasImage]);

  const handleMouseDown = useCallback((e) => {
    if (!hasImage || zoom <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
  }, [hasImage, zoom, pan]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({
      x: panStart.current.x + dx,
      y: panStart.current.y + dy,
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.25, 4)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.25, 1)), []);

  const transformStyle = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    cursor: isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'default',
  };

  const metaLabel = metadata ? `${metadata.width || width} × ${metadata.height || height}` : null;

  return (
    <div className="preview-canvas-frame">
      <div
        ref={wrapperRef}
        className="preview-canvas-viewport"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        role="img"
        aria-label={loading ? 'Generating artwork preview' : 'Artwork preview'}
      >
        <canvas
          ref={actualRef}
          width={width}
          height={height}
          className="preview-canvas"
          style={transformStyle}
        />
        {loading && (
          <div className="preview-loading-overlay">
            <div className="preview-loading-spinner" aria-hidden="true" />
            <div className="preview-loading-text">
              <p className="preview-loading-title">
                Generating artwork<span className="preview-cursor-blink">_</span>
              </p>
              <p className="preview-loading-subtitle">Rendering your current settings</p>
            </div>
          </div>
        )}
      </div>

      {/* Metadata bar */}
      <div className="preview-meta-bar">
        {metaLabel && (
          <span className="preview-meta-dimensions">{metaLabel}</span>
        )}
        {hasImage && (
          <div className="preview-zoom-controls">
            <button
              type="button"
              className="gallery-action-btn zoom-btn"
              onClick={zoomOut}
              disabled={zoom <= 1}
              aria-label="Zoom out"
              title="Zoom out"
            >
              −
            </button>
            <span className="preview-zoom-level">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="gallery-action-btn zoom-btn"
              onClick={zoomIn}
              disabled={zoom >= 4}
              aria-label="Zoom in"
              title="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="gallery-action-btn zoom-btn"
              onClick={resetView}
              disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
              aria-label="Reset view"
              title="Reset view"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default PreviewCanvas;
