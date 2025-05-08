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
    const canvas = actualRef.current;
    if (!canvas) return;
    
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
            backgroundColor: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '0.5rem',
            filter: loading ? 'blur(8px)' : 'none',
            transition: 'filter 0.3s ease-in-out',
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
            backgroundColor: 'rgba(0,0,0,0.6)', 
            borderRadius: '0.75rem',
            maxWidth: '100%',
            width: '100%',
            aspectRatio: '1/1',
            padding: '1rem'
          }}>
            <div className="loading-spinner" style={{ 
              animation: 'spin 1s linear infinite', 
              borderRadius: '9999px', 
              height: '4rem', 
              width: '4rem', 
              borderWidth: '4px', 
              borderStyle: 'solid',
              marginBottom: '1.5rem'
            }} />
            <div style={{
              color: 'white',
              textAlign: 'center',
              fontSize: '0.9rem',
              maxWidth: '80%',
              lineHeight: '1.4'
            }}>
              <p style={{ marginBottom: '0.5rem' }}>Larger pattern sizes take exponentially longer to create.</p>
              <p style={{ opacity: 0.8, fontSize: '0.8rem' }}>Please be patient while your art is being generated.</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
});

export default PreviewCanvas; 