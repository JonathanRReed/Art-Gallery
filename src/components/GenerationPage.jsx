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
  const [colorOrdering, setColorOrdering] = useState('rgb');
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
  const [savedSettings, setSavedSettings] = useState([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
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
      setShowSettingsPanel(!showSettingsPanel);
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
  }, [showSettingsPanel]);
  
  // Add a style block for the hover effects
  useEffect(() => {
    // Create and inject the CSS for hover effects
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .settings-item:hover {
        background-color: rgba(30, 41, 59, 0.6) !important;
      }
      .load-button:hover {
        background-color: rgba(16, 185, 129, 0.3) !important;
      }
      .delete-button:hover {
        background-color: rgba(239, 68, 68, 0.2) !important;
      }
    `;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
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
        alert('Failed to save settings due to serialization error.');
        return;
      }
      
      const updatedSettings = [...savedSettings, newSettings];
      setSavedSettings(updatedSettings);
      localStorage.setItem('savedSettings', JSON.stringify(updatedSettings));
      setSettingsName('');
      setShowSaveDialog(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  }

  function handleLoadSettings(savedSetting) {
    const { settings } = savedSetting;
    
    // Apply all settings
    setCurveType(settings.curveType || 'hilbert');
    setSeed(settings.seed || 1);
    setColorOrdering(settings.colorOrdering || 'rgb');
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
    } catch (error) {
      console.error('Error deleting settings:', error);
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
          alert(`Generation error: ${error.message}. Try a smaller pattern size.`);
        };
        
        worker.onmessage = (e) => {
          if (e.data.error) {
            console.error("Worker reported error:", e.data.error);
            setLoading(false);
            setProgress(0);
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
            
            setImageData(e.data.buffer);
            setImageMeta(metadata);
            setLoading(false);
            setProgress(100);
            setLastGeneratedPatternSize(patternSize); // Record the pattern size that was used
          }
        };
        
        // Create a worker message with all necessary parameters
        const workerMessage = {
          width: previewSize,
          height: previewSize,
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
          patternComplexity: patternSize, // Make sure this is sent as a dedicated parameter
          previewMode: true // Flag indicating this is a preview render
        };
        
        // Send the message to the worker
        worker.postMessage(workerMessage);
      } catch (error) {
        console.error("Error initializing worker:", error);
        setLoading(false);
        setProgress(0);
        alert(`Failed to start generator: ${error.message}`);
      }
    };
    
    // Start worker initialization
    createWorker();
  }

  function handleDownloadPNG() {
    if (!canvasRef.current || !imageData) return;
    
    // Show loading status
    setLoading(true);
    setProgress(0);
    
    // Create a new worker specifically for this export
    const worker = new window.Worker('/worker/color-mapper.js');
    
    // Set a timeout in case the worker hangs
    const timeoutId = setTimeout(() => {
      console.warn("Export timed out - cancelling");
      worker.terminate();
      setLoading(false);
      setProgress(0);
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
      } catch (error) {
        console.error("Export failed:", error);
        
        // Fallback to preview image
        try {
          const fallbackURL = canvasRef.current.toDataURL('image/png');
          const link = document.createElement('a');
          link.download = `art-gallery-${curveType}-${seed}-preview.png`;
          link.href = fallbackURL;
          link.click();
        } catch (fbError) {
          console.error("Fallback failed:", fbError);
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
      exactOutputSize: EXPORT_SIZE // Force exact output size
    });
  }

  function handleDownloadPDF() {
    if (!canvasRef.current || !imageData) return;
    
    // Import jsPDF dynamically
    import('jspdf').then(({ default: jsPDF }) => {
      // Show loading status
      setLoading(true);
      setProgress(0);
      
      // Create a new worker specifically for this export
      const worker = new window.Worker('/worker/color-mapper.js');
      
      // Set a timeout in case the worker hangs
      const timeoutId = setTimeout(() => {
        console.warn("PDF export timed out - cancelling");
        worker.terminate();
        setLoading(false);
        setProgress(0);
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
          } catch (fbError) {
            console.error("PDF fallback failed:", fbError);
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
        />
      </div>
      
      <div className="preview-wrapper">
        <div className="preview-container">
          <PreviewCanvas 
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
              marginTop: '0.5rem',
              marginBottom: loading && patternSize > 512 ? '0.5rem' : '0',
            }}>
              <div className="progress-bar" style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  backgroundColor: '#10b981',
                  transition: 'width 0.3s ease-in-out',
                }}></div>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '0.25rem',
                fontSize: '0.875rem',
                color: '#94a3b8',
              }}>
                <div>{progress}% completed</div>
                {patternSize > 512 && (
                  <button
                    onClick={handlePauseResume}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#10b981',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    {isPaused ? '▶️ Resume' : '⏸️ Pause'}
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
            fontSize: '0.875rem', 
            color: 'rgba(255, 255, 255, 0.6)'
          }}>
            Gallery saves to browser's local storage (5MB limit).
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
          padding: '1rem',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderRadius: '0.5rem',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
          maxHeight: '320px',
          maxWidth: '320px',
          overflowY: 'auto',
          backdropFilter: 'blur(8px)'
        }}>
          {/* Dropdown triangle pointer */}
          <div style={{
            position: 'absolute',
            top: '-8px',
            left: '30px',
            width: '16px',
            height: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            transform: 'rotate(45deg)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: '-1'
          }} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, color: '#e5e7eb' }}>Saved Settings</h3>
            <button
              onClick={() => setShowSettingsPanel(false)}
              className="gallery-action-btn"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#e5e7eb',
                cursor: 'pointer',
                fontSize: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.25rem'
              }}
            >
              ❌
            </button>
          </div>
          
          {savedSettings.length === 0 ? (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '1rem' }}>
              No saved settings yet. Save your current settings to use them later.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {savedSettings.map(setting => (
                <div 
                  key={setting.id} 
                  className="settings-item"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'rgba(30, 41, 59, 0.4)',
                    borderRadius: '0.375rem',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    transition: 'all 0.15s ease-in-out',
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)'
                  }}
                >
                  <div>
                    <div style={{ 
                      color: '#e5e7eb',
                      fontWeight: 'bold',
                      fontSize: '0.875rem'
                    }}>{setting.name}</div>
                    <div style={{ 
                      color: '#94a3b8', 
                      fontSize: '0.7rem' 
                    }}>
                      {new Date(setting.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      className="load-button gallery-action-btn"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleLoadSettings(setting); 
                      }}
                      style={{
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        color: '#10b981',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Load
                    </button>
                    
                    <button
                      className="delete-button gallery-action-btn"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleDeleteSettings(setting.id); 
                      }}
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        cursor: 'pointer',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Delete
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
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            borderRadius: '0.5rem',
            padding: '2rem',
            maxWidth: '450px',
            width: '90%'
          }}>
            <h2 style={{ margin: '0 0 1.5rem 0', color: '#f8fafc' }}>Save Current Settings</h2>
            
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e5e7eb' }}>
              Setting Name:
            </label>
            <input
              type="text"
              value={settingsName}
              onChange={(e) => setSettingsName(e.target.value)}
              placeholder="My awesome pattern"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.375rem',
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                marginBottom: '1rem'
              }}
            />
            
            <div style={{ 
              backgroundColor: 'rgba(59, 130, 246, 0.1)', 
              borderRadius: '0.375rem',
              padding: '0.75rem',
              marginBottom: '1.5rem',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <p style={{ 
                color: '#93c5fd', 
                fontSize: '0.85rem',
                margin: '0', 
                lineHeight: '1.4'
              }}>
                <strong>Local Storage Notice:</strong> Settings are saved locally in your browser (up to 5MB limit). 
                They will not transfer between browsers or devices and will be lost if you clear your browser data.
              </p>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="gallery-action-btn"
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.375rem',
                  backgroundColor: 'transparent',
                  border: '1px solid #4b5563',
                  color: '#e5e7eb',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              
              <button
                onClick={handleSaveSettings}
                className="gallery-action-btn"
                disabled={!settingsName.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.375rem',
                  backgroundColor: '#10b981',
                  border: 'none',
                  color: 'white',
                  cursor: settingsName.trim() ? 'pointer' : 'not-allowed',
                  opacity: settingsName.trim() ? 1 : 0.7
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 