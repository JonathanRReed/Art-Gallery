import React, { useRef } from 'react';

const growthModes = [
  { label: 'Crystal', value: 'crystal' },
  { label: 'Nebula', value: 'nebula' },
  { label: 'Rings', value: 'rings' },
];
const seedShapes = [
  { label: 'Point', value: 'point' },
  { label: 'Circle', value: 'circle' },
  { label: 'Line', value: 'line' },
];
const symmetryModes = [
  { label: 'None', value: 'none' },
  { label: 'Bilateral', value: 'bilateral' },
  { label: 'Quadrantal', value: 'quadrantal' },
  { label: 'Radial', value: 'radial' },
];
const colorProgressions = [
  { label: 'Sequential', value: 'sequential' },
  { label: 'Shuffled', value: 'shuffled' },
  { label: 'Base Distance', value: 'base-distance' },
];
const curveTypes = [
  { label: 'Hilbert', value: 'hilbert' },
  { label: 'Morton', value: 'morton' },
];
const colorOrderings = [
  { label: 'HSV', value: 'hsv' },
  { label: 'HVS', value: 'hvs' },
  { label: 'SHV', value: 'shv' },
  { label: 'SVH', value: 'svh' },
  { label: 'VHS', value: 'vhs' },
  { label: 'VSH', value: 'vsh' },
];

// Define tooltips for each control
const tooltips = {
  seed: "A numerical value that determines the starting point for the generation. The same seed will always produce the same result.",
  patternSize: "Controls the complexity and detail level of the generated pattern. Larger values create more intricate patterns but take longer to generate. The 'Extreme' option may cause slow performance on some devices.",
  growthMode: {
    crystal: "Creates crystalline formations with angular structures.",
    nebula: "Produces cloud-like, organic shapes with diffused edges.",
    rings: "Generates concentric circles and orbital patterns.",
  },
  seedShape: {
    point: "Starts growth from a single point at the center.",
    circle: "Begins with a circular boundary that expands outward.",
    line: "Initiates growth from a line across the center.",
  },
  branchingFactor: "Controls how much the pattern branches out. Higher values create more complex, tree-like structures.",
  growthRate: "Determines how quickly the pattern expands. Higher values create more rapid, expansive growth.",
  randomness: "Adds variability to the pattern. Higher values create more chaotic, unpredictable results.",
  colorProgression: {
    sequential: "Colors follow a strict sequence based on their position in the RGB space.",
    shuffled: "Colors are randomly arranged while maintaining visual coherence.",
    "base-distance": "Colors are distributed based on their distance from a base color.",
  },
  curveType: {
    hilbert: "A space-filling curve that preserves locality well, creating smoother color transitions.",
    morton: "Also known as Z-order curve, creates more blocky, quadrant-based patterns.",
  },
  colorOrdering: {
    hsv: "Arranges colors by Hue, Saturation, Value - emphasizing color families.",
    hvs: "Arranges by Hue, Value, Saturation - emphasizing brightness variations within hues.",
    shv: "Arranges by Saturation, Hue, Value - grouping by color intensity first.",
    svh: "Arranges by Saturation, Value, Hue - emphasizing intensity and brightness patterns.",
    vhs: "Arranges by Value, Hue, Saturation - creating bands of brightness.",
    vsh: "Arranges by Value, Saturation, Hue - emphasizing brightness and intensity patterns.",
  },
  symmetryMode: {
    none: "No symmetry applied - pattern grows freely in all directions.",
    bilateral: "Mirror symmetry along a central axis, like a butterfly's wings.",
    quadrantal: "Four-way symmetry, mirrored in four quadrants from the center.",
    radial: "Circular symmetry, repeating pattern radiates from the center point.",
  },
  distanceRandomness: "Controls random variation in the distance calculations. Higher values create more organic, less mathematical patterns.",
  colorSampleSize: "Determines how many color samples are taken. Higher values create more detailed color mapping.",
  previewSize: "Sets the resolution of the preview. Higher values show more detail but take longer to generate.",
};

// Helper component for label with tooltip with positioning options
const LabelWithTooltip = ({ children, tooltip, position = "top" }) => (
  <div className={`tooltip-wrapper tooltip-${position}`}>
    <span>{children}</span>
    <div className="info-icon">i</div>
    <div className="tooltip">{tooltip}</div>
  </div>
);

export default function ControlsPanel({
  curveType, setCurveType,
  seed, setSeed,
  colorOrdering, setColorOrdering,
  previewSize, setPreviewSize,
  symmetryMode, setSymmetryMode,
  distanceRandomness, setDistanceRandomness,
  colorSampleSize, setColorSampleSize,
  onRandomizeSeed, onGenerate,
  loading,
  growthMode, setGrowthMode,
  seedShape, setSeedShape,
  colorProgression, setColorProgression,
  branchingFactor, setBranchingFactor,
  growthRate, setGrowthRate,
  randomness, setRandomness,
  patternSize, setPatternSize,
}) {
  const settingsButtonRef = useRef(null);
  
  // Helper function to find the selected option label
  const getSelectedLabel = (options, value) => {
    return options.find(opt => opt.value === value)?.label || value;
  };
  
  // Pattern complexity options
  const patternOptions = [
    { label: 'Small (128)', value: 128 },
    { label: 'Medium (256)', value: 256 },
    { label: 'Large (512)', value: 512 },
    { label: 'Very Large (1024)', value: 1024 },
    { label: 'Ultra (2048)', value: 2048 },
    { label: 'Extreme (4096)', value: 4096 }
  ];
  
  return (
    <div className="panel-container">
      <div className="two-column-grid">
        <div className="panel-section">
          <h2 className="section-heading">Seed & Growth</h2>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: '1rem',
            paddingBottom: '0.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <button
              ref={settingsButtonRef}
              onClick={() => {
                const rect = settingsButtonRef.current.getBoundingClientRect();
                window.dispatchEvent(new CustomEvent('toggle-settings-panel', {
                  detail: { 
                    position: {
                      top: rect.bottom + window.scrollY,
                      left: rect.left + window.scrollX
                    }
                  }
                }));
              }}
              className="settings-button gallery-action-btn"
              title="Saved to browser's local storage (up to 5MB limit)"
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #4b5563',
                color: '#e5e7eb',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              ⚙️ Saved Settings
            </button>
            
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('show-save-dialog'))}
              className="save-settings-button gallery-action-btn"
              title="Save current generation settings for later use"
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #4b5563',
                color: '#e5e7eb',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
              disabled={loading}
            >
              💾 Save Current Settings
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="control-label">
                <LabelWithTooltip tooltip={tooltips.seed}>Seed</LabelWithTooltip>
              </label>
              <input
                type="number"
                className="control-input"
                value={seed}
                onChange={e => setSeed(Number(e.target.value))}
                disabled={loading}
                placeholder="Seed"
              />
            </div>
            <button
              className="dice-button gallery-action-btn"
              type="button"
              onClick={onRandomizeSeed}
              title="Randomize Seed"
              disabled={loading}
            >
              🎲
            </button>
          </div>
          
          <div className="control-row" style={{ marginBottom: '1.5rem' }}>
            <label className="control-label">
              <LabelWithTooltip tooltip={tooltips.patternSize}>
                Pattern Size
              </LabelWithTooltip>
            </label>
            <select 
              className="control-select" 
              value={patternSize} 
              onChange={e => setPatternSize(Number(e.target.value))} 
              disabled={loading}
              title={getSelectedLabel(patternOptions, patternSize)}
            >
              {patternOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          
          <div className="control-row">
            <label className="control-label">
              <LabelWithTooltip tooltip={tooltips.growthMode[growthMode] || "Determines the overall growth pattern of the generation."}>
                Growth Mode
              </LabelWithTooltip>
            </label>
            <select 
              className="control-select" 
              value={growthMode} 
              onChange={e => setGrowthMode(e.target.value)} 
              disabled={loading} 
              title={getSelectedLabel(growthModes, growthMode)}
            >
              {growthModes.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          
          <div className="control-row">
            <label className="control-label">
              <LabelWithTooltip tooltip={tooltips.seedShape[seedShape] || "The initial shape from which the pattern grows."}>
                Seed Shape
              </LabelWithTooltip>
            </label>
            <select 
              className="control-select" 
              value={seedShape} 
              onChange={e => setSeedShape(e.target.value)} 
              disabled={loading}
              title={getSelectedLabel(seedShapes, seedShape)}
            >
              {seedShapes.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          
          <div className="control-row">
            <label className="control-label">
              <LabelWithTooltip tooltip={tooltips.branchingFactor}>
                Branching Factor
              </LabelWithTooltip>
            </label>
            <input 
              type="range" 
              min={0} 
              max={1} 
              step={0.01} 
              value={branchingFactor} 
              onChange={e => setBranchingFactor(Number(e.target.value))} 
              className="control-range" 
              disabled={loading} 
            />
          </div>
          
          <div className="control-row">
            <label className="control-label">
              <LabelWithTooltip tooltip={tooltips.growthRate}>
                Growth Rate
              </LabelWithTooltip>
            </label>
            <input 
              type="range" 
              min={0.1} 
              max={2} 
              step={0.01} 
              value={growthRate} 
              onChange={e => setGrowthRate(Number(e.target.value))} 
              className="control-range" 
              disabled={loading} 
            />
          </div>
          
          <div className="control-row">
            <label className="control-label">
              <LabelWithTooltip tooltip={tooltips.randomness}>
                Randomness
              </LabelWithTooltip>
            </label>
            <input 
              type="range" 
              min={0} 
              max={50} 
              step={0.1} 
              value={randomness} 
              onChange={e => setRandomness(Number(e.target.value))} 
              className="control-range" 
              disabled={loading} 
            />
          </div>
        </div>
        
        <div className="panel-section">
          <h2 className="section-heading">Color & Symmetry</h2>
          
          <div className="control-row">
            <label className="control-label">
              <LabelWithTooltip tooltip={tooltips.colorProgression[colorProgression] || "How colors progress through the pattern."}>
                Color Progression
              </LabelWithTooltip>
            </label>
            <select 
              className="control-select" 
              value={colorProgression} 
              onChange={e => setColorProgression(e.target.value)} 
              disabled={loading}
              title={getSelectedLabel(colorProgressions, colorProgression)}
            >
              {colorProgressions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          
          <div className="control-row">
            <label className="control-label">
              <LabelWithTooltip tooltip={tooltips.curveType[curveType] || "The mathematical curve used to map colors to positions."}>
                Curve Type
              </LabelWithTooltip>
            </label>
            <select 
              className="control-select" 
              value={curveType} 
              onChange={e => setCurveType(e.target.value)} 
              disabled={loading}
              title={getSelectedLabel(curveTypes, curveType)}
            >
              {curveTypes.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          
          <div className="control-row">
            <label className="control-label">
              <LabelWithTooltip tooltip={tooltips.colorOrdering[colorOrdering] || "How the RGB components are ordered for color mapping."}>
                Color Ordering
              </LabelWithTooltip>
            </label>
            <select 
              className="control-select" 
              value={colorOrdering} 
              onChange={e => setColorOrdering(e.target.value)} 
              disabled={loading}
              title={getSelectedLabel(colorOrderings, colorOrdering)}
            >
              {colorOrderings.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          
          <div className="control-row">
            <label className="control-label">
              <LabelWithTooltip tooltip={tooltips.symmetryMode[symmetryMode] || "The type of symmetry applied to the pattern."}>
                Symmetry
              </LabelWithTooltip>
            </label>
            <select 
              className="control-select" 
              value={symmetryMode} 
              onChange={e => setSymmetryMode(e.target.value)} 
              disabled={loading}
              title={getSelectedLabel(symmetryModes, symmetryMode)}
            >
              {symmetryModes.map(opt => 
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              )}
            </select>
          </div>
        </div>
      </div>
      
      <details className="control-row">
        <summary className="advanced-summary">Advanced Settings</summary>
        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <label className="control-label">
            <LabelWithTooltip tooltip={tooltips.distanceRandomness} position="right">
              Distance Randomness
            </LabelWithTooltip>
            <input
              type="number"
              min={0}
              max={50}
              step={0.1}
              value={distanceRandomness}
              onChange={e => setDistanceRandomness(Number(e.target.value))}
              className="control-input"
              style={{ marginTop: '0.5rem' }}
              disabled={loading}
              placeholder="Distance Randomness"
            />
          </label>
          <label className="control-label">
            <LabelWithTooltip tooltip={tooltips.colorSampleSize} position="right">
              Color Sample Size
            </LabelWithTooltip>
            <input
              type="number"
              min={1}
              max={500}
              step={1}
              value={colorSampleSize}
              onChange={e => setColorSampleSize(Number(e.target.value))}
              className="control-input"
              style={{ marginTop: '0.5rem' }}
              disabled={loading}
              placeholder="Color Sample Size"
            />
          </label>
          <label className="control-label">
            <LabelWithTooltip tooltip={tooltips.previewSize} position="right">
              Preview Size
            </LabelWithTooltip>
          </label>
          <input
            type="range"
            min={64}
            max={512}
            step={64}
            value={previewSize}
            onChange={e => setPreviewSize(Number(e.target.value))}
            className="control-range"
            disabled={loading}
          />
          <div style={{ fontSize: '1rem', color: '#a5f3fc', marginTop: '0.5rem', textAlign: 'center' }}>{previewSize} × {previewSize}</div>
        </div>
      </details>
    </div>
  );
} 