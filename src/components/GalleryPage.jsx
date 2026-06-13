import React, { useEffect, useMemo, useRef, useState } from 'react';

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

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const SORT_OPTIONS = [
  { key: 'dateDesc', label: 'Date: newest' },
  { key: 'dateAsc', label: 'Date: oldest' },
  { key: 'curveType', label: 'Curve type' },
  { key: 'seed', label: 'Seed' },
];

export default function GalleryPage() {
  const [gallery, setGallery] = useState([]);
  const [viewIndex, setViewIndex] = useState(null);
  const [sortKey, setSortKey] = useState('dateDesc');
  const [searchQuery, setSearchQuery] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const modalRef = useRef(null);
  const modalImageRef = useRef(null);

  // Load gallery from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('gallery') || '[]');
      setGallery(stored);
    } catch (error) {
      console.error('Error loading gallery:', error);
      setGallery([]);
    }
  }, []);

  // Persist gallery changes
  useEffect(() => {
    if (gallery.length === 0 && !localStorage.getItem('gallery')) return;
    try {
      localStorage.setItem('gallery', JSON.stringify(gallery));
    } catch (error) {
      console.error('Error saving gallery:', error);
    }
  }, [gallery]);

  // Filter and sort
  const filteredGallery = useMemo(() => {
    let items = gallery;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((item) => {
        const p = item.params;
        return (
          (p.curveType || '').toLowerCase().includes(q) ||
          String(p.seed).includes(q) ||
          (p.growthMode || '').toLowerCase().includes(q) ||
          (p.symmetryMode || '').toLowerCase().includes(q) ||
          (p.colorProgression || '').toLowerCase().includes(q) ||
          (p.colorOrdering || '').toLowerCase().includes(q)
        );
      });
    }

    const sorted = [...items];
    switch (sortKey) {
      case 'dateDesc':
        sorted.sort((a, b) => b.savedAt - a.savedAt);
        break;
      case 'dateAsc':
        sorted.sort((a, b) => a.savedAt - b.savedAt);
        break;
      case 'curveType':
        sorted.sort((a, b) =>
          (a.params.curveType || '').localeCompare(b.params.curveType || '')
        );
        break;
      case 'seed':
        sorted.sort((a, b) => (a.params.seed || 0) - (b.params.seed || 0));
        break;
      default:
        break;
    }
    return sorted;
  }, [gallery, sortKey, searchQuery]);

  // Modal keyboard navigation & focus trap
  useEffect(() => {
    if (viewIndex === null) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setViewIndex(null);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setViewIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setViewIndex((prev) =>
          prev !== null && prev < filteredGallery.length - 1 ? prev + 1 : prev
        );
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    // Focus trap
    setTimeout(() => {
      if (modalRef.current) {
        modalRef.current.focus();
      }
    }, 10);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [viewIndex, filteredGallery.length]);

  // Measure image dimensions when modal changes
  useEffect(() => {
    if (viewIndex === null || !modalImageRef.current) {
      setImageDimensions({ width: 0, height: 0 });
      return;
    }

    const img = modalImageRef.current;
    function updateDims() {
      setImageDimensions({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
    }

    function handleError() {
      console.error('Failed to load image in modal');
      setImageDimensions({ width: 0, height: 0 });
    }

    if (img.complete) {
      updateDims();
    } else {
      img.addEventListener('load', updateDims);
      img.addEventListener('error', handleError);
      return () => {
        img.removeEventListener('load', updateDims);
        img.removeEventListener('error', handleError);
      };
    }
  }, [viewIndex]);

  function handleView(idx) {
    setViewIndex(idx);
  }

  function handleCloseModal() {
    setViewIndex(null);
  }

  function handlePrev() {
    setViewIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
  }

  function handleNext() {
    setViewIndex((prev) =>
      prev !== null && prev < filteredGallery.length - 1 ? prev + 1 : prev
    );
  }

  function handleDelete(id) {
    try {
      const updated = gallery.filter((item) => item.savedAt !== id);
      if (!checkSerializable(updated, 'updated gallery')) {
        console.error('Cannot serialize updated gallery');
        return;
      }
      setGallery(updated);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (error) {
      console.error('Error deleting from gallery:', error);
    }
  }

  function handleBatchDelete() {
    try {
      const updated = gallery.filter((item) => !selectedIds.has(item.savedAt));
      if (!checkSerializable(updated, 'updated gallery')) {
        console.error('Cannot serialize updated gallery');
        return;
      }
      setGallery(updated);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error batch deleting from gallery:', error);
    }
  }

  function handleDownload(item) {
    try {
      if (!item || !item.imageDataUrl) {
        console.error('Missing image data for download');
        return;
      }
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

  function handleBatchDownload() {
    const toDownload = gallery.filter((item) => selectedIds.has(item.savedAt));
    toDownload.forEach((item, idx) => {
      setTimeout(() => handleDownload(item), idx * 300);
    });
  }

  function handleRegenerate(item) {
    try {
      sessionStorage.setItem('regenerateParams', JSON.stringify(item.params));
      window.location.href = '/';
    } catch (error) {
      console.error('Error setting regenerate params:', error);
    }
  }

  function toggleSelection(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    const visibleIds = new Set(filteredGallery.map((item) => item.savedAt));
    const allSelected = visibleIds.size > 0 && [...visibleIds].every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function getItemNumber(idx) {
    return `${idx + 1} / ${filteredGallery.length}`;
  }

  const viewingItem = viewIndex !== null ? filteredGallery[viewIndex] : null;

  return (
    <>
      <div className="storage-disclaimer">
        <p>
          Saved artworks stay in this browser only. Use downloads if you want to keep or share them elsewhere.
        </p>
      </div>

      {/* Toolbar */}
      <div className="gallery-toolbar">
        <div className="gallery-search">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by curve, seed, or color..."
            aria-label="Search gallery"
          />
        </div>
        <div className="gallery-sort">
          <label htmlFor="gallery-sort">Sort</label>
          <select
            id="gallery-sort"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            aria-label="Sort gallery"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className={classNames('gallery-batch-toggle', batchMode && 'active')}
          onClick={() => {
            setBatchMode((v) => !v);
            setSelectedIds(new Set());
          }}
          aria-pressed={batchMode}
          aria-label={batchMode ? 'Exit batch mode' : 'Enter batch mode'}
        >
          {batchMode ? 'Done' : 'Select'}
        </button>
      </div>

      {/* Batch bar */}
      {batchMode && (
        <div className="gallery-batch-bar">
          <span className="gallery-batch-count">
            {selectedIds.size} selected
          </span>
          <div className="gallery-batch-actions">
            <button
              type="button"
              className="gallery-batch-btn"
              onClick={toggleSelectAll}
              aria-label="Select or deselect all visible items"
            >
              Toggle all
            </button>
            <button
              type="button"
              className="gallery-batch-btn"
              onClick={handleBatchDownload}
              disabled={selectedIds.size === 0}
              aria-label="Download selected artworks"
            >
              Download
            </button>
            <button
              type="button"
              className="gallery-batch-btn danger"
              onClick={handleBatchDelete}
              disabled={selectedIds.size === 0}
              aria-label="Delete selected artworks"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Results count */}
      {gallery.length > 0 && (
        <div className="gallery-results-count">
          Showing <span>{filteredGallery.length}</span> of{' '}
          <span>{gallery.length}</span> studies
        </div>
      )}

      {/* Masonry Grid */}
      <div className="gallery-masonry" role="list" aria-label="Saved artworks">
        {filteredGallery.length === 0 && (
          <div className="empty-gallery" role="status">
            <div className="empty-gallery-icon" aria-hidden="true">
              &mdash;
            </div>
            <div className="empty-gallery-title">
              {searchQuery ? 'No matches found' : 'Your archive is empty'}
            </div>
            <div className="empty-gallery-desc">
              {searchQuery
                ? 'Try adjusting your search terms, or clear the filter to see everything.'
                : 'Generate a piece on the main page, then save it here to build your own collection of algorithmic studies.'}
            </div>
            {!searchQuery && (
              <a
                href="/"
                className="gallery-action-btn"
              >
                Open Generator
              </a>
            )}
            {searchQuery && (
              <button
                type="button"
                className="gallery-action-btn"
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </button>
            )}
          </div>
        )}

        {filteredGallery.map((item, idx) => (
          <div
            key={item.savedAt}
            className="gallery-card"
            role="listitem"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (batchMode) {
                  toggleSelection(item.savedAt);
                } else {
                  handleView(idx);
                }
              }
            }}
          >
            {/* Batch checkbox */}
            {batchMode && (
              <label className="gallery-card-checkbox">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.savedAt)}
                  onChange={() => toggleSelection(item.savedAt)}
                  aria-label={`Select artwork ${idx + 1}`}
                />
              </label>
            )}

            {/* Delete confirmation overlay */}
            {deleteConfirmId === item.savedAt && (
              <div className="gallery-delete-confirm">
                <p>Delete this study?</p>
                <div className="gallery-delete-confirm-actions">
                  <button
                    type="button"
                    className="gallery-delete-confirm-btn cancel"
                    onClick={() => setDeleteConfirmId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="gallery-delete-confirm-btn confirm"
                    onClick={() => {
                      handleDelete(item.savedAt);
                      setDeleteConfirmId(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            <div className="gallery-card-image-wrapper">
              <img
                src={item.imageDataUrl}
                alt={`Algorithmic art: ${item.params.curveType} curve, seed ${item.params.seed}${item.params.growthMode ? `, ${item.params.growthMode} growth` : ''}`}
                className="gallery-card-image"
                loading="lazy"
                onClick={() => {
                  if (!batchMode) handleView(idx);
                }}
              />
              <div className="gallery-card-overlay" aria-hidden="true">
                <div className="gallery-card-meta-title">
                  {item.params.curveType}
                </div>
                <div className="gallery-card-meta">
                  Seed {item.params.seed}
                  {(item.params.growthMode || item.params.colorProgression) &&
                    ` · ${item.params.growthMode || item.params.colorProgression}`}
                </div>
                <div className="gallery-card-actions">
                  <button
                    type="button"
                    className="gallery-card-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleView(idx);
                    }}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="gallery-card-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(item);
                    }}
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    className="gallery-card-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRegenerate(item);
                    }}
                  >
                    Regenerate
                  </button>
                  <button
                    type="button"
                    className="gallery-card-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(item.savedAt);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            <div className="gallery-card-info-below">
              <span>{item.params.curveType}</span>
              <span>{formatDate(item.savedAt)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {viewingItem && (
        <div
          className="gallery-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Artwork ${viewIndex + 1} of ${filteredGallery.length}`}
          onClick={handleCloseModal}
          ref={modalRef}
          tabIndex={-1}
        >
          <div
            className="gallery-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="gallery-modal-close"
              onClick={handleCloseModal}
              aria-label="Close lightbox"
            >
              &times;
            </button>

            <img
              ref={modalImageRef}
              src={viewingItem.imageDataUrl}
              alt={`Full-size algorithmic art with ${viewingItem.params.curveType} curve, seed ${viewingItem.params.seed}`}
              className="gallery-modal-image"
            />

            <div className="gallery-modal-footer">
              <div className="gallery-modal-meta">
                <span>{viewingItem.params.curveType}</span> &middot; Seed{' '}
                <span>{viewingItem.params.seed}</span>
                {viewingItem.params.growthMode && (
                  <> &middot; <span>{viewingItem.params.growthMode}</span></>
                )}
                {viewingItem.params.symmetryMode && viewingItem.params.symmetryMode !== 'none' && (
                  <> &middot; {viewingItem.params.symmetryMode}</>
                )}
                {' '}&middot;{' '}
                {formatDate(viewingItem.savedAt)} {formatTime(viewingItem.savedAt)}
                {imageDimensions.width > 0 && (
                  <>
                    {' '}&middot;{' '}
                    <span>
                      {imageDimensions.width}&times;{imageDimensions.height}px
                    </span>
                  </>
                )}
              </div>
              <div className="gallery-modal-nav">
                <button
                  type="button"
                  className="gallery-modal-nav-btn"
                  onClick={handlePrev}
                  disabled={viewIndex === 0}
                  aria-label="Previous artwork"
                >
                  &larr; Prev
                </button>
                <button
                  type="button"
                  className="gallery-modal-nav-btn"
                  onClick={handleNext}
                  disabled={viewIndex === filteredGallery.length - 1}
                  aria-label="Next artwork"
                >
                  Next &rarr;
                </button>
              </div>
            </div>

            <div className="gallery-modal-hints" aria-hidden="true">
              <kbd>Esc</kbd> close
              <kbd>&larr;</kbd> prev
              <kbd>&rarr;</kbd> next
            </div>
          </div>
        </div>
      )}
    </>
  );
}
