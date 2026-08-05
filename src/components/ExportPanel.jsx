import React from 'react';

export default function ExportPanel({
  onDownloadPNG,
  onDownloadPDF,
  onGenerate,
  loading,
  patternSizeChanged,
  hasArtwork
}) {
  return (
    <div className="export-panel">
      <button
        className="generate-button"
        type="button"
        onClick={onGenerate}
        disabled={loading}
      >
        {loading ? 'Plotting…' : patternSizeChanged ? 'Regenerate at new size' : 'Generate artwork'}
      </button>

      <div className="export-actions">
        <button
          className="export-button"
          type="button"
          onClick={onDownloadPNG}
          disabled={!hasArtwork || loading}
        >
          Download PNG
        </button>
        <button
          className="export-button"
          type="button"
          onClick={onDownloadPDF}
          disabled={!hasArtwork || loading}
        >
          Download PDF
        </button>
      </div>

      <p className="export-note">
        {hasArtwork
          ? 'Exports render at 4096 × 4096 for high-resolution output.'
          : 'Nothing to export yet. Plot a piece first.'}
      </p>
    </div>
  );
}
