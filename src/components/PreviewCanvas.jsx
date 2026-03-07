import React, { useRef, useEffect, forwardRef, useState } from 'react';

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
  const [renderedSize, setRenderedSize] = useState({ width, height });

  useEffect(() => {
    console.log('🎨 PreviewCanvas useEffect triggered', {
      hasImageData: !!imageData,
      imageDataType: imageData?.constructor?.name,
      imageDataLength: imageData?.length,
      loading,
      canvasWidth: width,
      canvasHeight: height,
      metadata
    });

    const canvas = actualRef.current;
    if (!canvas) {
      console.log('❌ No canvas ref');
      return;
    }

    const ctx = canvas.getContext('2d', {
      alpha: true,
      desynchronized: true // May improve performance
    });

    // Ensure the canvas is the correct size
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      setRenderedSize({ width, height });
    }

    if (imageData instanceof Uint8ClampedArray) {
      try {
        // Use metadata dimensions if available
        const imgWidth = metadata?.width || width;
        const imgHeight = metadata?.height || height;
        const pixelCount = imageData.length / 4; // RGBA = 4 bytes per pixel

        console.log(`Rendering image: ${imgWidth}x${imgHeight}, data length: ${imageData.length}, canvas: ${width}x${height}`);

        if (pixelCount === imgWidth * imgHeight) {
          // Image data matches the expected dimensions

          // For very large images (like AllRGB 4096x4096), we need special handling
          // to avoid crashing the browser with huge memory allocations
          const MAX_SAFE_SIZE = 2048; // Maximum safe size for ImageData

          if (imgWidth > MAX_SAFE_SIZE || imgHeight > MAX_SAFE_SIZE) {
            // Large image: DON'T try to create ImageData - it will crash the browser!
            // Just show a placeholder and let user download the full image
            console.log(`Large image detected: ${imgWidth}x${imgHeight}, skipping preview (use download)`);

            ctx.clearRect(0, 0, width, height);

            // Draw a nice placeholder with gradient
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, '#1e293b');
            gradient.addColorStop(0.5, '#334155');
            gradient.addColorStop(1, '#1e293b');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            // Draw checkmark and text
            ctx.fillStyle = '#22c55e';
            ctx.font = 'bold 48px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('✓', width / 2, height / 2 - 20);

            ctx.fillStyle = '#e2e8f0';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText('AllRGB Complete!', width / 2, height / 2 + 20);

            ctx.fillStyle = '#94a3b8';
            ctx.font = '14px sans-serif';
            ctx.fillText(`${imgWidth} × ${imgHeight} pixels`, width / 2, height / 2 + 45);
            ctx.fillText('Click "Download PNG" to save', width / 2, height / 2 + 70);

            setRenderedSize({ width: imgWidth, height: imgHeight });
            return;
          }

          const imgData = new ImageData(imageData, imgWidth, imgHeight);

          if (imgWidth === width && imgHeight === height) {
            // Direct rendering if sizes match
            ctx.putImageData(imgData, 0, 0);
            console.log(`Rendered preview image directly: ${width}x${height}`);
          } else {
            // Scale to fit the canvas
            ctx.clearRect(0, 0, width, height);

            // Create a temporary canvas with the image data
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imgWidth;
            tempCanvas.height = imgHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imgData, 0, 0);

            // Draw scaled to our display canvas
            ctx.drawImage(tempCanvas, 0, 0, width, height);
            console.log(`Rendered resized preview: original ${imgWidth}x${imgHeight}, displayed at ${width}x${height}`);
          }

          setRenderedSize({ width: imgWidth, height: imgHeight });
        } else {
          // Fall back to square dimensions if metadata doesn't match
          const imgSize = Math.sqrt(pixelCount);

          if (Math.floor(imgSize) === imgSize) {
            // It's a perfect square, render it
            const imgData = new ImageData(imageData, imgSize, imgSize);

            // Scale to fit the canvas
            ctx.clearRect(0, 0, width, height);

            // Create a temporary canvas with the image data
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imgSize;
            tempCanvas.height = imgSize;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imgData, 0, 0);

            // Draw scaled to our display canvas
            ctx.drawImage(tempCanvas, 0, 0, width, height);

            console.log(`Rendered resized preview (calculated size): ${imgSize}x${imgSize}, displayed at ${width}x${height}`);
            setRenderedSize({ width: imgSize, height: imgSize });
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
      // Clear canvas if data is invalid
      ctx.clearRect(0, 0, width, height);
    }
  }, [imageData, width, height, actualRef, metadata]);

  return (
    <>
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: '512px'
      }}>
        <canvas
          ref={actualRef}
          width={width}
          height={height}
          className="preview-canvas"
          style={{
            width: '100%',
            maxWidth: '100%',
            height: 'auto',
            aspectRatio: '1/1',
            objectFit: 'contain',
            display: 'block',
            backgroundColor: 'var(--color-paper-alt)',
            border: 'var(--border-ink)',
            borderRadius: '0',
            filter: loading ? 'contrast(1.2) grayscale(0.2)' : 'none',
            transition: 'filter 0.2s ease-in-out',
          }}
        />
        {loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(240, 238, 233, 0.8)',
            backdropFilter: 'blur(4px)',
            borderRadius: '0',
            maxWidth: '100%',
            width: '100%',
            aspectRatio: '1/1',
            padding: '1rem',
            border: 'var(--border-ink)'
          }}>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0; }
              }
            `}</style>
            <div className="loading-spinner" style={{
              animation: 'spin 1s linear infinite',
              borderRadius: '0',
              height: '3rem',
              width: '3rem',
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: 'var(--color-ink)',
              borderTopColor: 'var(--color-accent)',
              marginBottom: '1.5rem'
            }} />
            <div style={{
              color: 'var(--color-ink)',
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontSize: '0.8rem',
              maxWidth: '80%',
              lineHeight: '1.4'
            }}>
              <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>[GENERATING_ARTWORK]<span style={{ animation: 'blink 1s step-end infinite' }}>_</span></p>
              <p style={{ opacity: 0.7, fontSize: '0.7rem' }}>PROCESSING COMPLEX PATTERN</p>
            </div>
          </div>
        )}
      </div >
    </>
  );
});

export default PreviewCanvas; 