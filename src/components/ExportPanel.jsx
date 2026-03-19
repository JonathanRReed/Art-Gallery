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
        className="generate-button gallery-action-btn"
        type="button"
        onClick={onGenerate}
        disabled={loading}
        style={{
          width: '100%',
          marginBottom: '1rem',
          fontWeight: 'bold'
        }}
      >
        {loading ? 'Generating…' : patternSizeChanged ? 'Regenerate with New Size' : 'Generate Artwork'}
      </button>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
        <button
          className="export-button gallery-action-btn"
          type="button"
          onClick={onDownloadPNG}
          disabled={!hasArtwork || loading}
        >
          Download PNG
        </button>
        <button
          className="export-button gallery-action-btn"
          type="button"
          onClick={onDownloadPDF}
          disabled={!hasArtwork || loading}
        >
          Download PDF
        </button>
      </div>

      <div style={{
        marginTop: '0.75rem',
        fontSize: '0.8rem',
        color: 'var(--color-ink)',
        fontWeight: 600,
        padding: '0.5rem',
        backgroundColor: 'var(--color-paper)',
        textAlign: 'center'
      }}>
        <div>{hasArtwork ? 'Exports render at 4096 × 4096 for high-resolution output.' : 'Generate a piece to unlock PNG and PDF export.'}</div>
      </div>
    </div>
  );
}