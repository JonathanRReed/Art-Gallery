import React, { useRef, useEffect, useState, useCallback, useId } from 'react';

const growthModes = [
  { label: 'Crystal', value: 'crystal' },
  { label: 'Nebula', value: 'nebula' },
  { label: 'Rings', value: 'rings' },
];
const seedShapes = [
  { label: 'Point', value: 'point' },
  { label: 'Dual (2 points)', value: 'dual' },
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
  { label: 'Saturation (AllRGB style)', value: 'saturation' },
  { label: 'Brightness', value: 'brightness' },
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
    dual: "Begins with two seed points for symmetrical growth.",
    circle: "Begins with a circular boundary that expands outward.",
    line: "Initiates growth from a line across the center.",
  },
  branchingFactor: "Controls how much the pattern branches out. Higher values create more complex, tree-like structures.",
  growthRate: "Determines how quickly the pattern expands. Higher values create more rapid, expansive growth.",
  randomness: "Adds variability to the pattern. Higher values create more chaotic, unpredictable results.",
  colorProgression: {
    sequential: "Colors follow a strict sequence based on their position in the RGB space.",
    shuffled: "Colors are randomly arranged while maintaining visual coherence.",
    'base-distance': "Colors are distributed based on their distance from a base color.",
    saturation: "Arranges colors by saturation for an AllRGB-style effect.",
    brightness: "Arranges colors by brightness intensity.",
  },
  curveType: {
    hilbert: "A space-filling curve that preserves locality well, creating smoother color transitions.",
    morton: "Also known as Z-order curve, creates more blocky, quadrant-based patterns.",
  },
  colorOrdering: {
    hsv: "Arranges colors by Hue, Saturation, Value — emphasizing color families.",
    hvs: "Arranges by Hue, Value, Saturation — emphasizing brightness variations within hues.",
    shv: "Arranges by Saturation, Hue, Value — grouping by color intensity first.",
    svh: "Arranges by Saturation, Value, Hue — emphasizing intensity and brightness patterns.",
    vhs: "Arranges by Value, Hue, Saturation — creating bands of brightness.",
    vsh: "Arranges by Value, Saturation, Hue — emphasizing brightness and intensity patterns.",
  },
  symmetryMode: {
    none: "No symmetry applied — pattern grows freely in all directions.",
    bilateral: "Mirror symmetry along a central axis, like a butterfly's wings.",
    quadrantal: "Four-way symmetry, mirrored in four quadrants from the center.",
    radial: "Circular symmetry, repeating pattern radiates from the center point.",
  },
  distanceRandomness: "Controls random variation in the distance calculations. Higher values create more organic, less mathematical patterns.",
  colorSampleSize: "Determines how many color samples are taken. Higher values create more detailed color mapping.",
  previewSize: "Sets the resolution of the preview. Higher values show more detail but take longer to generate.",
  allRGBMode: "When enabled, forces a 4096×4096 AllRGB generation where every RGB color appears exactly once.",
};

function LabelWithTooltip({ children, tooltip, position = "top" }) {
  const tipId = useId();
  return (
    <span className={`tooltip-wrapper${position !== "top" ? ` tooltip-${position}` : ""}`}>
      <span>{children}</span>
      <span
        className="info-icon"
        tabIndex={0}
        role="img"
        aria-label="More information"
        aria-describedby={tipId}
      >
        i
      </span>
      <span className="tooltip" role="tooltip" id={tipId}>{tooltip}</span>
    </span>
  );
}

function CollapsibleSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="panel-section-collapsible">
      <button
        type="button"
        className="section-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={`section-chevron${open ? ' open' : ''}`} aria-hidden="true">&#9654;</span>
        <span className="section-heading-sm">{title}</span>
      </button>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

function SelectControl({ id, label, value, onChange, options, tooltipMap, loading, getLabel }) {
  const tooltip = tooltipMap?.[value] || tooltipMap;
  return (
    <div className="control-row">
      <label htmlFor={id} className="control-label">
        <LabelWithTooltip tooltip={tooltip}>{label}</LabelWithTooltip>
      </label>
      <select
        id={id}
        className="control-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        title={getLabel ? getLabel(options, value) : undefined}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function RangeControl({ id, label, value, onChange, min, max, step, tooltip, loading, ariaLabel }) {
  return (
    <div className="control-row">
      <label htmlFor={id} className="control-label">
        <LabelWithTooltip tooltip={tooltip}>{label}</LabelWithTooltip>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="control-range"
        disabled={loading}
        aria-label={ariaLabel || label}
      />
    </div>
  );
}

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
  allRGBMode, setAllRGBMode,
}) {
  const settingsButtonRef = useRef(null);
  const seedInputRef = useRef(null);

  const getSelectedLabel = (options, value) =>
    options.find((opt) => opt.value === value)?.label || value;

  const patternOptions = [
    { label: 'Small (128)', value: 128 },
    { label: 'Medium (256)', value: 256 },
    { label: 'Large (512)', value: 512 },
    { label: 'Very Large (1024)', value: 1024 },
    { label: 'Ultra (2048)', value: 2048 },
    { label: 'Extreme (4096)', value: 4096 }
  ];

  const handleKeyDown = useCallback((e) => {
    const tag = e.target.tagName?.toLowerCase();
    const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    if (isTyping) return;

    if (e.code === 'Space' && !loading) {
      e.preventDefault();
      onGenerate();
    }
    if (e.code === 'KeyR' && !loading) {
      e.preventDefault();
      onRandomizeSeed();
      seedInputRef.current?.focus();
    }
  }, [loading, onGenerate, onRandomizeSeed]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const dispatchToggleSettings = () => {
    const rect = settingsButtonRef.current?.getBoundingClientRect();
    // .settings-panel is position:fixed, so feed it viewport coordinates
    // (no scroll offset) and clamp so it can't overflow the right edge.
    window.dispatchEvent(new CustomEvent('toggle-settings-panel', {
      detail: {
        position: rect
          ? { top: rect.bottom, left: Math.min(rect.left, window.innerWidth - 320 - 8) }
          : { top: 0, left: 0 }
      }
    }));
  };

  const dispatchShowSaveDialog = () => {
    window.dispatchEvent(new CustomEvent('show-save-dialog'));
  };

  return (
    <div className="panel-container">
      {/* Top actions bar */}
      <div className="control-actions-bar">
        <button
          ref={settingsButtonRef}
          onClick={dispatchToggleSettings}
          className="gallery-action-btn"
          type="button"
          title="Saved to browser's local storage"
          disabled={loading}
        >
          Load Config
        </button>
        <button
          onClick={dispatchShowSaveDialog}
          className="gallery-action-btn"
          type="button"
          title="Save current generation settings for later use"
          disabled={loading}
        >
          Save Config
        </button>
      </div>

      {/* Seed & Quick Actions */}
      <CollapsibleSection title="Seed & Quick Actions" defaultOpen={true}>
        <div className="seed-control-row">
          <div className="seed-input-wrap">
            <label htmlFor="seed-input" className="control-label">
              <LabelWithTooltip tooltip={tooltips.seed}>Seed</LabelWithTooltip>
            </label>
            <input
              ref={seedInputRef}
              id="seed-input"
              type="number"
              className="control-input"
              value={seed}
              min="0"
              max="2147483647"
              onChange={(e) => setSeed(Math.max(0, Math.min(Number(e.target.value), 2147483647)))}
              disabled={loading}
              placeholder="Seed"
            />
          </div>
          <button
            className="dice-button"
            type="button"
            onClick={onRandomizeSeed}
            title="Randomize Seed (R)"
            disabled={loading}
            aria-label="Randomize seed"
          >
            <span aria-hidden="true">&#9858;</span> Randomize
          </button>
        </div>

        <SelectControl
          id="pattern-size-select"
          label="Pattern Size"
          value={patternSize}
          onChange={(v) => setPatternSize(Number(v))}
          options={patternOptions}
          tooltipMap={tooltips.patternSize}
          loading={loading}
          getLabel={getSelectedLabel}
        />

        <div className="kbd-hints">
          <span className="kbd-hint"><kbd>Space</kbd> Generate</span>
          <span className="kbd-hint"><kbd>R</kbd> Randomize</span>
        </div>
      </CollapsibleSection>

      {/* Growth Parameters */}
      <CollapsibleSection title="Growth Parameters" defaultOpen={true}>
        <SelectControl
          id="growth-mode-select"
          label="Growth Mode"
          value={growthMode}
          onChange={setGrowthMode}
          options={growthModes}
          tooltipMap={tooltips.growthMode}
          loading={loading}
          getLabel={getSelectedLabel}
        />

        <SelectControl
          id="seed-shape-select"
          label="Seed Shape"
          value={seedShape}
          onChange={setSeedShape}
          options={seedShapes}
          tooltipMap={tooltips.seedShape}
          loading={loading}
          getLabel={getSelectedLabel}
        />

        <RangeControl
          id="branching-factor-range"
          label="Branching Factor"
          value={branchingFactor}
          onChange={setBranchingFactor}
          min={0}
          max={1}
          step={0.01}
          tooltip={tooltips.branchingFactor}
          loading={loading}
        />

        <RangeControl
          id="growth-rate-range"
          label="Growth Rate"
          value={growthRate}
          onChange={setGrowthRate}
          min={0.1}
          max={2}
          step={0.01}
          tooltip={tooltips.growthRate}
          loading={loading}
        />

        <RangeControl
          id="randomness-range"
          label="Randomness"
          value={randomness}
          onChange={setRandomness}
          min={0}
          max={50}
          step={0.1}
          tooltip={tooltips.randomness}
          loading={loading}
        />
      </CollapsibleSection>

      {/* Color & Symmetry */}
      <CollapsibleSection title="Color & Symmetry" defaultOpen={true}>
        <SelectControl
          id="color-progression-select"
          label="Color Progression"
          value={colorProgression}
          onChange={setColorProgression}
          options={colorProgressions}
          tooltipMap={tooltips.colorProgression}
          loading={loading}
          getLabel={getSelectedLabel}
        />

        <SelectControl
          id="curve-type-select"
          label="Curve Type"
          value={curveType}
          onChange={setCurveType}
          options={curveTypes}
          tooltipMap={tooltips.curveType}
          loading={loading}
          getLabel={getSelectedLabel}
        />

        <SelectControl
          id="color-ordering-select"
          label="Color Ordering"
          value={colorOrdering}
          onChange={setColorOrdering}
          options={colorOrderings}
          tooltipMap={tooltips.colorOrdering}
          loading={loading}
          getLabel={getSelectedLabel}
        />

        <SelectControl
          id="symmetry-mode-select"
          label="Symmetry"
          value={symmetryMode}
          onChange={setSymmetryMode}
          options={symmetryModes}
          tooltipMap={tooltips.symmetryMode}
          loading={loading}
          getLabel={getSelectedLabel}
        />
      </CollapsibleSection>

      {/* Advanced */}
      <CollapsibleSection title="Advanced" defaultOpen={false}>
        <div className="control-row">
          <label htmlFor="distance-randomness-input" className="control-label">
            <LabelWithTooltip tooltip={tooltips.distanceRandomness} position="right">
              Distance Randomness
            </LabelWithTooltip>
          </label>
          <input
            id="distance-randomness-input"
            type="number"
            min={0}
            max={50}
            step={0.1}
            value={distanceRandomness}
            onChange={(e) => setDistanceRandomness(Number(e.target.value))}
            className="control-input"
            disabled={loading}
            placeholder="Distance Randomness"
          />
        </div>

        <div className="control-row">
          <label htmlFor="color-sample-size-input" className="control-label">
            <LabelWithTooltip tooltip={tooltips.colorSampleSize} position="right">
              Color Sample Size
            </LabelWithTooltip>
          </label>
          <input
            id="color-sample-size-input"
            type="number"
            min={1}
            max={500}
            step={1}
            value={colorSampleSize}
            onChange={(e) => setColorSampleSize(Number(e.target.value))}
            className="control-input"
            disabled={loading}
            placeholder="Color Sample Size"
          />
        </div>

        <RangeControl
          id="preview-size-range"
          label="Preview Size"
          value={previewSize}
          onChange={setPreviewSize}
          min={64}
          max={512}
          step={64}
          tooltip={tooltips.previewSize}
          loading={loading}
        />
        <div className="preview-size-readout">{previewSize} × {previewSize}</div>

        {setAllRGBMode && (
          <div className="control-row allrgb-toggle">
            <label className="control-label">
              <LabelWithTooltip tooltip={tooltips.allRGBMode} position="right">
                AllRGB Mode
              </LabelWithTooltip>
            </label>
            <button
              type="button"
              className={`gallery-action-btn toggle-btn${allRGBMode ? ' active' : ''}`}
              onClick={() => setAllRGBMode((v) => !v)}
              disabled={loading}
              aria-pressed={allRGBMode}
            >
              {allRGBMode ? 'On' : 'Off'}
            </button>
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
