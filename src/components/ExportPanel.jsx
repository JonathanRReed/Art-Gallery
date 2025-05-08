import React from 'react';

export default function ExportPanel({
  onDownloadPNG,
  onDownloadPDF,
  onGenerate,
  loading,
  patternSizeChanged
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
          backgroundColor: '#10b981', 
          fontWeight: 'bold' 
        }}
      >
        {loading ? 'Generating...' : patternSizeChanged ? 'Apply Pattern Size Change' : 'Generate'}
      </button>
      
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
        <button
          className="export-button gallery-action-btn"
          type="button"
          onClick={onDownloadPNG}
        >
          Download PNG
        </button>
        <button
          className="export-button gallery-action-btn"
          type="button"
          onClick={onDownloadPDF}
        >
          Download PDF
        </button>
      </div>
      
      <div style={{ 
        marginTop: '0.75rem', 
        fontSize: '0.8rem', 
        color: '#94a3b8', 
        padding: '0.5rem',
        backgroundColor: 'rgba(30, 41, 59, 0.5)',
        borderRadius: '0.375rem',
        textAlign: 'center'
      }}>
        <div>Downloads will use the preview size.</div>
      </div>
    </div>
  );
} 