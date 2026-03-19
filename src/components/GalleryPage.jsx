import React, { useEffect, useState } from 'react';

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

export default function GalleryPage() {
  const [gallery, setGallery] = useState([]);
  const [viewIndex, setViewIndex] = useState(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('gallery') || '[]');
      setGallery(stored);
    } catch (error) {
      console.error('Error loading gallery:', error);
      setGallery([]);
    }
  }, []);

  function handleView(idx) {
    setViewIndex(idx);
  }

  function handleCloseModal() {
    setViewIndex(null);
  }

  function handleDelete(idx) {
    try {
      const updated = [...gallery];
      updated.splice(idx, 1);

      // Validate JSON serialization
      if (!checkSerializable(updated, 'updated gallery')) {
        console.error('Cannot serialize updated gallery');
        return;
      }

      setGallery(updated);
      localStorage.setItem('gallery', JSON.stringify(updated));
    } catch (error) {
      console.error('Error deleting from gallery:', error);
    }
  }

  function handleDownload(idx) {
    try {
      const item = gallery[idx];
      if (!item || !item.imageDataUrl) {
        console.error('Missing image data for download');
        return;
      }

      // Create download link
      const link = document.createElement('a');
      link.href = item.imageDataUrl;
      link.download = `algorithmic-art-${item.params.curveType}-seed-${item.params.seed}-${new Date(item.savedAt).toISOString().split('T')[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  }

  return (
    <>
      <div className="storage-disclaimer" style={{
        backgroundColor: 'var(--color-paper-alt)',
        padding: '1rem',
        marginBottom: '2.5rem',
        border: '1px dashed var(--color-ink)',
        maxWidth: '800px',
        margin: '0 auto 3rem auto',
      }}>
        <p style={{
          color: 'var(--color-ink)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          fontWeight: 600,
          margin: '0',
          lineHeight: '1.5',
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Saved artworks stay in this browser only. Use downloads if you want to keep or share them elsewhere.
        </p>
      </div>

      <div className="gallery-grid">
        {gallery.length === 0 && (
          <div className="empty-gallery" style={{ padding: '3rem 1.5rem' }}>
            <div style={{ fontSize: '1.25rem', color: 'var(--color-ink)', marginBottom: '0.75rem' }}>
              Your archive is empty.
            </div>
            <div style={{ maxWidth: '32rem', margin: '0 auto', lineHeight: '1.7', textTransform: 'none', letterSpacing: 'normal' }}>
              Generate a piece on the main page, then save it here to build your own collection of algorithmic studies.
            </div>
            <a
              href="/"
              className="gallery-action-btn"
              style={{ display: 'inline-block', marginTop: '1rem', textDecoration: 'none' }}
            >
              Open Generator
            </a>
          </div>
        )}
        {gallery.map((item, idx) => (
          <div key={item.savedAt} className="gallery-card">
            <img
              src={item.imageDataUrl}
              alt={`Algorithmic art with ${item.params.curveType} curve, seed ${item.params.seed}, ${item.params.colorOrdering} color ordering`}
              className="gallery-card-image"
            />
            <div className="gallery-card-info">
              <div><span>CURVE_TYPE</span> <b>{item.params.curveType}</b></div>
              <div><span>SEED_VAL</span> <b>{item.params.seed}</b></div>
              <div><span>COLOR_SEQ</span> <b>{item.params.colorOrdering}</b></div>
              <div><span>TIMESTAMP</span> <b>{new Date(item.savedAt).toLocaleDateString()}</b></div>
            </div>
            <div className="gallery-card-buttons">
              <button
                className="gallery-btn-view"
                type="button"
                onClick={() => handleView(idx)}
              >
                Preview
              </button>
              <button
                className="gallery-btn-view"
                type="button"
                onClick={() => handleDownload(idx)}
              >
                Download
              </button>
              <button
                className="gallery-btn-delete"
                type="button"
                onClick={() => handleDelete(idx)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {viewIndex !== null && gallery[viewIndex] && (
        <div className="gallery-modal" onClick={handleCloseModal}>
          <div className="gallery-modal-content" onClick={e => e.stopPropagation()}>
            <button
              className="gallery-modal-close"
              onClick={handleCloseModal}
              aria-label="Close modal"
            >
              [X]
            </button>
            <img
              src={gallery[viewIndex].imageDataUrl}
              alt={`Full-size algorithmic art with ${gallery[viewIndex].params.curveType} curve, seed ${gallery[viewIndex].params.seed}`}
              className="gallery-modal-image"
            />
          </div>
        </div>
      )}
    </>
  );
} 