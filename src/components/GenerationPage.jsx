import React, { useState, useRef, useEffect } from 'react';
import ControlsPanel from './ControlsPanel.jsx';
import PreviewCanvas from './PreviewCanvas.jsx';
import ExportPanel from './ExportPanel.jsx';

const PREVIEW_SIZE = 512; // Use a small preview for static hosting

// Debug helper to check for circular references or other JSON issues
function checkSerializable(obj, name = 'object') {
  try {
    const serialized = JSON.stringify(obj);
    if (serialized === undefined) {
      console.warn(`${name} serializes to undefined`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`${name} is not serializable:`, err.message);
    return false;
  }
}

function saveToGallery({ imageDataUrl, params }) {
  try {
    // Validate objects before stringifying
    if (typeof params !== 'object') {
      console.error('Invalid params object for gallery save');
      return;
    }

    const gallery = JSON.parse(localStorage.getItem('gallery') || '[]');
    const itemToSave = { imageDataUrl, params, savedAt: Date.now() };

    // Validate JSON serialization
    if (!checkSerializable(itemToSave, 'gallery item')) {
      return;
    }

    gallery.unshift(itemToSave);
    localStorage.setItem('gallery', JSON.stringify(gallery));
  } catch (error) {
    console.error('Error saving to gallery:', error);
  }
}

export default function GenerationPage() {
  const [curveType, setCurveType] = useState('hilbert');
  const [seed, setSeed] = useState(1);
  const [colorOrdering, setColorOrdering] = useState('hsv');
  const [loading, setLoading] = useState(false);
  const [imageData, setImageData] = useState(null);
  const [imageMeta, setImageMeta] = useState(null);
  const [previewSize, setPreviewSize] = useState(128);
  const [patternSize, setPatternSize] = useState(128); // Default pattern complexity
  const [lastGeneratedPatternSize, setLastGeneratedPatternSize] = useState(128); // Track last generated pattern size
  const [symmetry, setSymmetry] = useState(true);
  const [distanceRandomness, setDistanceRandomness] = useState(10);
  const [colorSampleSize, setColorSampleSize] = useState(100);
  const [growthMode, setGrowthMode] = useState('crystal');
  const [seedShape, setSeedShape] = useState('point');
  const [symmetryMode, setSymmetryMode] = useState('quadrantal');
  const [colorProgression, setColorProgression] = useState('shuffled');
  const [branchingFactor, setBranchingFactor] = useState(0.5);
  const [growthRate, setGrowthRate] = useState(1);
  const [randomness, setRandomness] = useState(10);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [allRGBMode, setAllRGBMode] = useState(false);
  const [renderKey, setRenderKey] = useState(0); // Force re-render key
  const [savedSettings, setSavedSettings] = useState([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [settingsButtonPosition, setSettingsButtonPosition] = useState({ top: 0, left: 0 });
  const settingsButtonRef = useRef(null);
  const workerRef = useRef(null);
  const canvasRef = useRef(null);

  // Fixed export size - increase to match maximum pattern size
  const EXPORT_SIZE = 4096; // Match the Extreme pattern size option for highest quality exports

  // Load saved settings on mount
  useEffect(() => {
    try {
      const settings = JSON.parse(localStorage.getItem('savedSettings') || '[]');
      setSavedSettings(settings);
    } catch (error) {
      console.error('Error loading saved settings:', error);
      setSavedSettings([]);
    }
  }, []);

  // Add event listeners for settings buttons
  useEffect(() => {
    // Handle toggle settings panel
    const handleToggleSettingsPanel = (e) => {
      if (e.detail && e.detail.position) {
        setSettingsButtonPosition(e.detail.position);
      }
      setShowSettingsPanel((current) => !current);
    };

    const handleShowSaveDialog = () => {
      setShowSaveDialog(true);
    };

    window.addEventListener('toggle-settings-panel', handleToggleSettingsPanel);
    window.addEventListener('show-save-dialog', handleShowSaveDialog);

    return () => {
      window.removeEventListener('toggle-settings-panel', handleToggleSettingsPanel);
      window.removeEventListener('show-save-dialog', handleShowSaveDialog);
    };
  }, []);

  function getCurrentSettings() {
    return {
      curveType,
      seed,
      colorOrdering,
      previewSize,
      symmetry,
      distanceRandomness,
      colorSampleSize,
      growthMode,
      seedShape,
      symmetryMode,
      colorProgression,
      branchingFactor,
      growthRate,
      randomness,
      patternSize
    };
  }

  function updateFeedback(type, message) {
    setFeedback({ type, message });
  }

  function handleSaveSettings() {
    if (!settingsName.trim()) return;

    const newSettings = {
      id: Date.now(),
      name: settingsName.trim(),
      timestamp: Date.now(),
      settings: getCurrentSettings()
    };

    try {
      // Validate JSON serialization
      if (!checkSerializable(newSettings, 'settings object')) {
        updateFeedback('error', 'Unable to save this configuration right now.');
        return;
      }

      const updatedSettings = [...savedSettings, newSettings];
      setSavedSettings(updatedSettings);
      localStorage.setItem('savedSettings', JSON.stringify(updatedSettings));
      setSettingsName('');
      setShowSaveDialog(false);
      updateFeedback('success', 'Configuration saved to this browser.');
    } catch (error) {
      console.error('Error saving settings:', error);
      updateFeedback('error', 'Failed to save your configuration. Please try again.');
    }
  }

  function handleLoadSettings(savedSetting) {
    const { settings } = savedSetting;

    // Apply all settings
    setCurveType(settings.curveType || 'hilbert');
    setSeed(settings.seed || 1);
    setColorOrdering(settings.colorOrdering || 'hsv');
    setPreviewSize(settings.previewSize || 128);
    setSymmetry(settings.symmetry !== undefined ? settings.symmetry : true);
    setDistanceRandomness(settings.distanceRandomness || 10);
    setColorSampleSize(settings.colorSampleSize || 100);
    setGrowthMode(settings.growthMode || 'crystal');
    setSeedShape(settings.seedShape || 'point');
    setSymmetryMode(settings.symmetryMode || 'quadrantal');
    setColorProgression(settings.colorProgression || 'shuffled');
    setBranchingFactor(settings.branchingFactor || 0.5);
    setGrowthRate(settings.growthRate || 1);
    setRandomness(settings.randomness || 10);
    setPatternSize(settings.patternSize || 128);

    setShowSettingsPanel(false);
    updateFeedback('success', `Loaded configuration: ${savedSetting.name}.`);
  }

  function handleDeleteSettings(id) {
    try {
      const updatedSettings = savedSettings.filter(setting => setting.id !== id);

      // Validate JSON serialization
      if (!checkSerializable(updatedSettings, 'updated settings')) {
        console.error('Cannot serialize updated settings');
        return;
      }

      setSavedSettings(updatedSettings);
      localStorage.setItem('savedSettings', JSON.stringify(updatedSettings));
      updateFeedback('success', 'Saved configuration removed.');
    } catch (error) {
      console.error('Error deleting settings:', error);
      updateFeedback('error', 'Could not delete that saved configuration.');
    }
  }

  function handleRandomizeSeed() {
    setSeed(Math.floor(Math.random() * 100000));
  }

  function handlePauseResume() {
    if (!workerRef.current) return;

    setIsPaused(!isPaused);
    workerRef.current.postMessage({
      command: isPaused ? 'resume' : 'pause'
    });
  }

  function handleGenerate() {
    setLoading(true);
    setImageData(null);
    setProgress(0);
    setIsPaused(false);
    updateFeedback('info', 'Generating a new artwork…');

    // Terminate existing worker if any
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    // Create worker lazily only when needed
    const createWorker = async () => {
      try {
        // Lazy load worker
        workerRef.current = new window.Worker('/worker/color-mapper.js');
        const worker = workerRef.current;

        // Add error handling
        worker.onerror = (error) => {
          console.error("Worker error during generation:", error);
          setLoading(false);
          setProgress(0);
          updateFeedback('error', `Generation failed. ${error.message} Try a smaller pattern size.`);
        };

        worker.onmessage = (e) => {
          if (e.data.error) {
            console.error("Worker reported error:", e.data.error);
            setLoading(false);
            setProgress(0);
            updateFeedback('error', e.data.error);
            return;
          }

          // Handle LIVE PREVIEW during generation (watch the crystal grow!)
          if (e.data.preview && e.data.buffer) {
            const metadata = e.data.metadata || { width: previewSize, height: previewSize };

            // Convert buffer if needed
            let imageBuffer = e.data.buffer;
            if (imageBuffer instanceof ArrayBuffer) {
              imageBuffer = new Uint8ClampedArray(imageBuffer);
            }

            // Update preview (but keep loading state)
            setImageData(imageBuffer);
            setImageMeta(metadata);
            setRenderKey(k => k + 1);
            setProgress(e.data.progress || 0);
            return;
          }

          if (e.data.progress) {
            // Update progress
            setProgress(e.data.progress);
            return;
          }

          if (e.data.buffer) {
            // Check if metadata is available
            const metadata = e.data.metadata || { width: previewSize, height: previewSize };

            // Handle both Uint8ClampedArray and ArrayBuffer (from transfer)
            let imageBuffer = e.data.buffer;
            if (imageBuffer instanceof ArrayBuffer) {
              imageBuffer = new Uint8ClampedArray(imageBuffer);
            }

            setImageData(imageBuffer);
            setImageMeta(metadata);
            setRenderKey(k => k + 1); // Force PreviewCanvas re-render
            setLoading(false);
            setProgress(100);
            setLastGeneratedPatternSize(patternSize); // Record the pattern size that was used
            updateFeedback('success', 'Artwork generated. You can export it or save it to your gallery.');
          }
        };

        // Create a worker message with all necessary parameters
        // For AllRGB mode, force 4096x4096 dimensions
        const effectiveSize = allRGBMode ? 4096 : previewSize;
        const workerMessage = {
          width: effectiveSize,
          height: effectiveSize,
          seed,
          symmetry,
          distanceRandomness,
          colorSampleSize,
          curveType,
          colorOrdering,
          growthMode,
          seedShape,
          symmetryMode,
          colorProgression,
          branchingFactor,
          growthRate,
          randomness,
          patternComplexity: allRGBMode ? 4096 : patternSize, // Force 4096 for AllRGB
          previewMode: !allRGBMode, // Not preview mode for AllRGB
          allRGBMode // NEW: Pass AllRGB mode flag to worker
        };

        // Send the message to the worker
        worker.postMessage(workerMessage);
      } catch (error) {
        console.error("Error initializing worker:", error);
        setLoading(false);
        setProgress(0);
        updateFeedback('error', `Failed to start the generator: ${error.message}`);
      }
    };

    // Start worker initialization
    createWorker();
  }

  function handleDownloadPNG() {
    if (!canvasRef.current || !imageData) return;

    // For AllRGB mode, use the existing data directly - it's already 4096x4096
    if (allRGBMode && imageMeta?.width === 4096 && imageMeta?.height === 4096) {
      setLoading(true);

      try {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = 4096;
        exportCanvas.height = 4096;
        const ctx = exportCanvas.getContext('2d');

        const exportImageData = new ImageData(new Uint8ClampedArray(imageData), 4096, 4096);
        ctx.putImageData(exportImageData, 0, 0);

        // Use toBlob instead of toDataURL for large images (more reliable)
        exportCanvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `allrgb-${seed}.png`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            updateFeedback('success', 'PNG export started.');
          } else {
            console.error('toBlob returned null');
            updateFeedback('error', 'Could not create the PNG export.');
          }
          setLoading(false);
        }, 'image/png');
        return;
      } catch (error) {
        console.error('AllRGB direct download failed:', error);
        setLoading(false);
        updateFeedback('error', 'Direct PNG export failed. Falling back to regenerated export.');
        // Fall through to worker-based export
      }
    }

    // Show loading status
    setLoading(true);
    setProgress(0);
    updateFeedback('info', 'Preparing PNG export…');

    // Create a new worker specifically for this export
    const worker = new window.Worker('/worker/color-mapper.js');

    // Set a timeout in case the worker hangs
    const timeoutId = setTimeout(() => {
      console.warn("Export timed out - cancelling");
      worker.terminate();
      setLoading(false);
      setProgress(0);
      updateFeedback('error', 'PNG export timed out. Try a smaller pattern size.');
    }, 180000); // 3 minutes

    // Handle worker completion
    worker.onmessage = (e) => {
      // Handle progress updates
      if (e.data.progress) {
        setProgress(e.data.progress);
        return;
      }

      // Clear timeout since we got a response
      clearTimeout(timeoutId);

      // Handle errors
      if (e.data.error) {
        console.error("Export error:", e.data.error);
        setLoading(false);
        setProgress(0);
        worker.terminate();
        updateFeedback('error', e.data.error);
        return;
      }

      try {
        // Check if we got a valid buffer
        if (!e.data.buffer || e.data.buffer.byteLength === 0) {
          throw new Error("Worker returned empty data");
        }

        // Create a canvas at the correct export size
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = EXPORT_SIZE;
        exportCanvas.height = EXPORT_SIZE;
        const ctx = exportCanvas.getContext('2d');

        // Create image data from buffer
        const imageArray = new Uint8ClampedArray(e.data.buffer);

        // Handle the case where the buffer doesn't match the expected size
        const expectedPixels = EXPORT_SIZE * EXPORT_SIZE;
        const actualPixels = imageArray.length / 4;

        if (actualPixels !== expectedPixels) {
          console.warn(`Size mismatch: Got ${actualPixels} pixels but expected ${expectedPixels}`);

          // Create a temporary canvas with the actual data
          const tempCanvas = document.createElement('canvas');
          const tempSize = Math.sqrt(actualPixels);

          if (Math.floor(tempSize) === tempSize) {
            // Valid square image - create temp canvas and scale up
            tempCanvas.width = tempSize;
            tempCanvas.height = tempSize;
            const tempCtx = tempCanvas.getContext('2d');

            // Put actual image data on temp canvas
            const tempImageData = new ImageData(imageArray, tempSize, tempSize);
            tempCtx.putImageData(tempImageData, 0, 0);

            // Draw scaled version on export canvas
            ctx.drawImage(tempCanvas, 0, 0, EXPORT_SIZE, EXPORT_SIZE);
          } else {
            throw new Error(`Cannot create valid image from buffer size ${imageArray.length}`);
          }
        } else {
          // Buffer matches expected size - draw directly
          const exportImageData = new ImageData(imageArray, EXPORT_SIZE, EXPORT_SIZE);
          ctx.putImageData(exportImageData, 0, 0);
        }

        // Convert to PNG and download
        const dataURL = exportCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `art-gallery-${curveType}-${seed}-${EXPORT_SIZE}px.png`;
        link.href = dataURL;
        link.click();
        updateFeedback('success', 'PNG export started.');
      } catch (error) {
        console.error("Export failed:", error);

        // Fallback to preview image
        try {
          const fallbackURL = canvasRef.current.toDataURL('image/png');
          const link = document.createElement('a');
          link.download = `art-gallery-${curveType}-${seed}-preview.png`;
          link.href = fallbackURL;
          link.click();
          updateFeedback('info', 'High-resolution export failed, so the preview PNG was downloaded instead.');
        } catch (fbError) {
          console.error("Fallback failed:", fbError);
          updateFeedback('error', 'PNG export failed. Please try again with a smaller pattern size.');
        }
      } finally {
        setLoading(false);
        setProgress(0);
        worker.terminate();
      }
    };

    // Generate a completely new image at the export size
    worker.postMessage({
      width: allRGBMode ? 4096 : EXPORT_SIZE,
      height: allRGBMode ? 4096 : EXPORT_SIZE,
      seed,
      symmetry,
      distanceRandomness,
      colorSampleSize,
      curveType,
      colorOrdering,
      growthMode,
      seedShape,
      symmetryMode,
      colorProgression,
      branchingFactor,
      growthRate,
      randomness,
      patternComplexity: allRGBMode ? 4096 : patternSize,
      exportMode: true,
      exactOutputSize: allRGBMode ? 4096 : EXPORT_SIZE,
      allRGBMode // Add AllRGB mode flag
    });
  }

  function handleDownloadPDF() {
    if (!canvasRef.current || !imageData) return;

    // Import jsPDF dynamically
    import('jspdf').then(({ default: jsPDF }) => {
      // Show loading status
      setLoading(true);
      setProgress(0);
      updateFeedback('info', 'Preparing PDF export…');

      // Create a new worker specifically for this export
      const worker = new window.Worker('/worker/color-mapper.js');

      // Set a timeout in case the worker hangs
      const timeoutId = setTimeout(() => {
        console.warn("PDF export timed out - cancelling");
        worker.terminate();
        setLoading(false);
        setProgress(0);
        updateFeedback('error', 'PDF export timed out. Try a smaller pattern size.');
      }, 180000); // 3 minutes

      // Handle worker completion
      worker.onmessage = (e) => {
        // Handle progress updates
        if (e.data.progress) {
          setProgress(e.data.progress);
          return;
        }

        // Clear timeout since we got a response
        clearTimeout(timeoutId);

        // Handle errors
        if (e.data.error) {
          console.error("PDF export error:", e.data.error);
          setLoading(false);
          setProgress(0);
          worker.terminate();
          updateFeedback('error', e.data.error);
          return;
        }

        try {
          // Check if we got a valid buffer
          if (!e.data.buffer || e.data.buffer.byteLength === 0) {
            throw new Error("Worker returned empty data for PDF");
          }

          // Create a canvas at the correct export size
          const exportCanvas = document.createElement('canvas');
          exportCanvas.width = EXPORT_SIZE;
          exportCanvas.height = EXPORT_SIZE;
          const ctx = exportCanvas.getContext('2d');

          // Create image data from buffer
          const imageArray = new Uint8ClampedArray(e.data.buffer);

          // Handle the case where the buffer doesn't match the expected size
          const expectedPixels = EXPORT_SIZE * EXPORT_SIZE;
          const actualPixels = imageArray.length / 4;

          if (actualPixels !== expectedPixels) {
            console.warn(`PDF size mismatch: Got ${actualPixels} pixels but expected ${expectedPixels}`);

            // Create a temporary canvas with the actual data
            const tempCanvas = document.createElement('canvas');
            const tempSize = Math.sqrt(actualPixels);

            if (Math.floor(tempSize) === tempSize) {
              // Valid square image - create temp canvas and scale up
              tempCanvas.width = tempSize;
              tempCanvas.height = tempSize;
              const tempCtx = tempCanvas.getContext('2d');

              // Put actual image data on temp canvas
              const tempImageData = new ImageData(imageArray, tempSize, tempSize);
              tempCtx.putImageData(tempImageData, 0, 0);

              // Draw scaled version on export canvas
              ctx.drawImage(tempCanvas, 0, 0, EXPORT_SIZE, EXPORT_SIZE);
            } else {
              throw new Error(`Cannot create valid PDF from buffer size ${imageArray.length}`);
            }
          } else {
            // Buffer matches expected size - draw directly
            const exportImageData = new ImageData(imageArray, EXPORT_SIZE, EXPORT_SIZE);
            ctx.putImageData(exportImageData, 0, 0);
          }

          // Create PDF
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'in',
            format: 'letter'
          });

          // Get the image as data URL
          const imgData = exportCanvas.toDataURL('image/png');

          // Calculate PDF dimensions (keeping it simple)
          const pdfWidth = 8.5;
          const pdfHeight = 11;
          const imageSize = Math.min(pdfWidth, pdfHeight) * 0.9; // 90% of shortest dimension
          const xOffset = (pdfWidth - imageSize) / 2;
          const yOffset = (pdfHeight - imageSize) / 2;

          // Add image to PDF and save
          pdf.addImage(imgData, 'PNG', xOffset, yOffset, imageSize, imageSize);
          pdf.save(`art-gallery-${curveType}-${seed}-${EXPORT_SIZE}px.pdf`);
          updateFeedback('success', 'PDF export started.');
        } catch (error) {
          console.error("PDF export failed:", error);

          // Fallback to preview image
          try {
            const fallbackURL = canvasRef.current.toDataURL('image/png');
            const pdf = new jsPDF({
              orientation: 'portrait',
              unit: 'in',
              format: 'letter'
            });

            const pdfWidth = 8.5;
            const pdfHeight = 11;
            const imageSize = Math.min(pdfWidth, pdfHeight) * 0.9;
            const xOffset = (pdfWidth - imageSize) / 2;
            const yOffset = (pdfHeight - imageSize) / 2;

            pdf.addImage(fallbackURL, 'PNG', xOffset, yOffset, imageSize, imageSize);
            pdf.save(`art-gallery-${curveType}-${seed}-preview.pdf`);
            updateFeedback('info', 'High-resolution PDF export failed, so a preview PDF was downloaded instead.');
          } catch (fbError) {
            console.error("PDF fallback failed:", fbError);
            updateFeedback('error', 'PDF export failed. Please try again with a smaller pattern size.');
          }
        } finally {
          setLoading(false);
          setProgress(0);
          worker.terminate();
        }
      };

      // Generate a completely new image at the export size
      worker.postMessage({
        width: EXPORT_SIZE,
        height: EXPORT_SIZE,
        seed,
        symmetry,
        distanceRandomness,
        colorSampleSize,
        curveType,
        colorOrdering,
        growthMode,
        seedShape,
        symmetryMode,
        colorProgression,
        branchingFactor,
        growthRate,
        randomness,
        patternComplexity: patternSize,
        exportMode: true,
        format: 'pdf',
        exactOutputSize: EXPORT_SIZE // Force exact output size
      });
    }).catch(error => {
      console.error("Error loading PDF library:", error);
      setLoading(false);
      updateFeedback('error', 'The PDF export library could not be loaded.');
    });
  }

  function handleSaveToGallery() {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    saveToGallery({
      imageDataUrl: dataUrl,
      params: {
        curveType,
        seed,
        colorOrdering,
        exportSize: previewSize,
        patternSize
      },
    });
    updateFeedback('success', 'Saved to your local gallery.');
  }

  return (
    <div className="main-container">
      <div className="controls-wrapper">
        <ControlsPanel
          curveType={curveType}
          setCurveType={setCurveType}
          seed={seed}
          setSeed={setSeed}
          colorOrdering={colorOrdering}
          setColorOrdering={setColorOrdering}
          previewSize={previewSize}
          setPreviewSize={setPreviewSize}
          symmetry={symmetry}
          setSymmetry={setSymmetry}
          distanceRandomness={distanceRandomness}
          setDistanceRandomness={setDistanceRandomness}
          colorSampleSize={colorSampleSize}
          setColorSampleSize={setColorSampleSize}
          onRandomizeSeed={handleRandomizeSeed}
          onGenerate={handleGenerate}
          loading={loading}
          growthMode={growthMode}
          setGrowthMode={setGrowthMode}
          seedShape={seedShape}
          setSeedShape={setSeedShape}
          symmetryMode={symmetryMode}
          setSymmetryMode={setSymmetryMode}
          colorProgression={colorProgression}
          setColorProgression={setColorProgression}
          branchingFactor={branchingFactor}
          setBranchingFactor={setBranchingFactor}
          growthRate={growthRate}
          setGrowthRate={setGrowthRate}
          randomness={randomness}
          setRandomness={setRandomness}
          patternSize={patternSize}
          setPatternSize={setPatternSize}
          allRGBMode={allRGBMode}
          setAllRGBMode={setAllRGBMode}
        />
      </div>

      <div className="preview-wrapper">
        <div className="preview-container">
          {feedback && (
            <div style={{
              width: '100%',
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              border: 'var(--border-ink)',
              backgroundColor: feedback.type === 'error' ? 'rgba(228, 61, 48, 0.16)' : feedback.type === 'success' ? 'rgba(85, 103, 255, 0.14)' : 'var(--color-paper-alt)',
              color: 'var(--color-ink)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              {feedback.message}
            </div>
          )}

          <PreviewCanvas
            key={renderKey}
            imageData={imageData}
            loading={loading}
            width={previewSize}
            height={previewSize}
            canvasRef={canvasRef}
            metadata={imageMeta}
          />

          {loading && (
            <div className="progress-container" style={{
              width: '100%',
              marginTop: '1.5rem',
              border: 'var(--border-ink)',
              padding: '0.5rem',
              backgroundColor: 'var(--color-paper-alt)'
            }}>
              <div className="progress-bar" style={{
                width: '100%',
                height: '0.5rem',
                backgroundColor: 'var(--color-paper)',
                border: 'var(--border-ink)',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  backgroundColor: 'var(--color-accent)',
                  transition: 'width 0.2s cubic-bezier(0.2, 0, 0, 1)'
                }}></div>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '0.5rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                color: 'var(--color-ink)',
              }}>
                <div>[PROGRESS_REQ: {progress}%]</div>
                {patternSize > 512 && (
                  <button
                    onClick={handlePauseResume}
                    style={{
                      backgroundColor: 'var(--color-ink)',
                      border: 'var(--border-ink)',
                      color: 'var(--color-paper)',
                      fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      boxShadow: '2px 2px 0 0 var(--color-accent)',
                    }}
                  >
                    {isPaused ? 'RESUME' : 'PAUSE'}
                  </button>
                )}
              </div>
            </div>
          )}

          <ExportPanel
            onDownloadPNG={handleDownloadPNG}
            onDownloadPDF={handleDownloadPDF}
            onGenerate={handleGenerate}
            loading={loading}
            patternSizeChanged={patternSize !== lastGeneratedPatternSize}
            hasArtwork={Boolean(imageData)}
          />

          <div className="action-buttons">
            <button
              className="save-button gallery-action-btn"
              type="button"
              disabled={!imageData || loading}
              onClick={handleSaveToGallery}
            >
              Save to Gallery
            </button>

            <a
              href="/gallery"
              className="save-button gallery-action-btn"
              style={{
                display: 'inline-block',
                textDecoration: 'none',
                textAlign: 'center'
              }}
            >
              View Gallery
            </a>
          </div>

          <div style={{
            textAlign: 'center',
            marginTop: '0.75rem',
            fontSize: '0.75rem',
            color: 'var(--color-ink)',
            fontWeight: 600
          }}>
            Your gallery and saved configurations stay in this browser.
          </div>
        </div>
      </div>

      {/* Settings panel dropdown - positioned fixed to the viewport */}
      {showSettingsPanel && (
        <div className="settings-panel" style={{
          position: 'fixed',
          top: `${settingsButtonPosition.top}px`,
          left: `${settingsButtonPosition.left}px`,
          zIndex: 1000,
          padding: '1.5rem',
          backgroundColor: 'var(--color-paper)',
          border: 'var(--border-ink)',
          boxShadow: '8px 8px 0 0 var(--color-ink)',
          maxHeight: '320px',
          maxWidth: '300px',
          overflowY: 'auto'
        }}>
          {/* Dropdown triangle pointer removed for flat aesthetic */}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid var(--color-ink)', paddingBottom: '0.5rem' }}>
            <h3 style={{ margin: 0, color: 'var(--color-ink)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>Saved Configurations</h3>
            <button
              onClick={() => setShowSettingsPanel(false)}
              className="gallery-action-btn"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--color-ink)',
                cursor: 'pointer',
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0',
                lineHeight: 1
              }}
              aria-label="Close settings panel"
            >
              &times;
            </button>
          </div>

          {savedSettings.length === 0 ? (
            <div style={{ color: 'var(--color-ink)', textAlign: 'center', padding: '0.75rem', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              No saved settings yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {savedSettings.map(setting => (
                <div
                  key={setting.id}
                  className="settings-item"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    backgroundColor: 'var(--color-paper-alt)',
                    border: 'var(--border-ink)',
                    marginBottom: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{
                      color: 'var(--color-ink)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      textTransform: 'uppercase'
                    }}>{setting.name}</div>
                    <div style={{
                      color: 'var(--color-ink-light)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      fontWeight: 600
                    }}>
                      {new Date(setting.timestamp).toLocaleDateString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                    <button
                      className="load-button gallery-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLoadSettings(setting);
                      }}
                      style={{
                        backgroundColor: 'var(--color-ink)',
                        border: 'var(--border-ink)',
                        color: 'var(--color-paper)',
                        flex: 1
                      }}
                    >
                      LOAD
                    </button>

                    <button
                      className="delete-button gallery-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSettings(setting.id);
                      }}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'var(--border-ink)',
                        color: 'var(--color-accent)',
                        flex: 1
                      }}
                    >
                      DELETE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save Settings Dialog */}
      {showSaveDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'var(--color-overlay)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--color-paper)',
            border: 'var(--border-ink)',
            padding: '2rem',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '12px 12px 0 0 var(--color-ink)'
          }}>
            <h2 style={{ margin: '0 0 1.5rem 0', color: 'var(--color-ink)', fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '-0.02em', borderBottom: '2px solid var(--color-ink)', paddingBottom: '0.5rem' }}>Save Conf.</h2>

            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-ink)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Configuration Name
            </label>
            <input
              type="text"
              value={settingsName}
              onChange={(e) => setSettingsName(e.target.value)}
              placeholder="e.g. MONOCHROME_VOID"
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'var(--color-paper-alt)',
                border: 'var(--border-ink)',
                color: 'var(--color-ink)',
                marginBottom: '1.5rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9rem',
                textTransform: 'uppercase'
              }}
            />

            <div style={{
              backgroundColor: 'var(--color-paper-alt)',
              padding: '0.75rem',
              marginBottom: '1.5rem',
              border: '1px dashed var(--color-ink-light)'
            }}>
              <p style={{
                color: 'var(--color-ink)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.76rem',
                fontWeight: 600,
                margin: '0',
                lineHeight: '1.5',
                textTransform: 'uppercase'
              }}>
                [SYS_NOTE] Settings are preserved in local browser cache. Cross-device synchronization is unavailable.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="gallery-action-btn"
                style={{
                  padding: '0.75rem 1.25rem',
                  backgroundColor: 'transparent',
                  border: 'var(--border-ink)',
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                CANCEL
              </button>

              <button
                onClick={handleSaveSettings}
                className="gallery-action-btn"
                disabled={!settingsName.trim()}
                style={{
                  padding: '0.75rem 1.25rem',
                  backgroundColor: 'var(--color-ink)',
                  border: 'var(--border-ink)',
                  color: 'var(--color-paper)',
                  fontFamily: 'var(--font-mono)',
                  cursor: settingsName.trim() ? 'pointer' : 'not-allowed',
                  opacity: settingsName.trim() ? 1 : 0.5,
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  boxShadow: '4px 4px 0 0 var(--color-ink-light)'
                }}
              >
                COMMIT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 