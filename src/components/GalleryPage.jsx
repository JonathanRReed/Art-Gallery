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
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '0.5rem',
        padding: '1rem',
        marginBottom: '1.5rem',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        maxWidth: '800px',
        margin: '0 auto 2rem auto',
      }}>
        <p style={{
          color: '#93c5fd',
          fontSize: '0.9rem',
          margin: '0',
          lineHeight: '1.4',
          textAlign: 'center'
        }}>
          <strong>Local Storage Notice:</strong> Gallery images are saved locally in your browser 
          (up to 5MB total limit). Large or many images may reach this limit. 
          Images will not transfer between browsers or devices and will be lost if you clear your browser data.
        </p>
      </div>
      
      <div className="gallery-grid">
        {gallery.length === 0 && (
          <div className="empty-gallery">
            No posters saved yet. Return to the generator to create some art!
          </div>
        )}
        {gallery.map((item, idx) => (
          <div key={item.savedAt} className="gallery-card">
            <img
              src={item.imageDataUrl}
              alt="Poster preview"
              className="gallery-card-image"
            />
            <div className="gallery-card-info">
              <div>Curve: <b>{item.params.curveType}</b></div>
              <div>Seed: <b>{item.params.seed}</b></div>
              <div>Color Order: <b>{item.params.colorOrdering}</b></div>
              <div>Date: <b>{new Date(item.savedAt).toLocaleDateString()}</b></div>
            </div>
            <div className="gallery-card-buttons">
              <button
                className="gallery-btn-view gallery-action-btn"
                type="button"
                onClick={() => handleDownload(idx)}
              >
                Download
              </button>
              <button
                className="gallery-btn-delete gallery-action-btn"
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
            >
              ×
            </button>
            <img
              src={gallery[viewIndex].imageDataUrl}
              alt="Full size poster"
              className="gallery-modal-image"
            />
          </div>
        </div>
      )}
    </>
  );
} 