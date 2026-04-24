// src/components/VideosPage.js  ── Simplified: search any topic, top 3 viewed
import React, { useState } from 'react';
import './videos.css';
import { videos as videosApi } from '../services/api';

const VideosPage = () => {
  const [query, setQuery]           = useState('');
  const [videos, setVideos]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [searchedFor, setSearchedFor] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setVideos([]);
    setHasSearched(true);

    try {
      const data = await videosApi.search({ q: query.trim() });
      setVideos(data.videos || []);
      setSearchedFor(data.query || query.trim());
    } catch (err) {
      setError(err.data?.error || 'Failed to load videos. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="video-page-wrapper">
      <div className="video-links-module">

        {/* ── Header ── */}
        <header className="video-links-header">
          <div className="video-links-title-group">
            <div className="video-icon-pulse"><span>V</span></div>
            <div>
              <h1 className="video-links-title">Video Learning Hub</h1>
              <p className="video-links-subtitle">
                Search any topic — get the top 3 most watched videos
              </p>
            </div>
          </div>
        </header>

        {/* ── Search Box ── */}
        <form className="video-search-form" onSubmit={handleSearch}>
          <input
            type="text"
            className="video-search-input"
            placeholder="e.g. Newton's laws, Photosynthesis, Quadratic Equations…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="video-search-button" disabled={loading}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {/* ── Results ── */}
        <section className="video-results-section">

          {/* Welcome state */}
          {!hasSearched && (
            <div className="video-welcome-block">
              <div className="video-welcome-text">
                <h2>Find the best videos for any topic</h2>
                <p>
                  Type any topic above — we'll pull the top 3 most watched YouTube videos
                  so you always get the most trusted explanations first.
                </p>
              </div>
              <div className="video-welcome-illustration">
                <div className="video-welcome-circle video-welcome-circle-1" />
                <div className="video-welcome-circle video-welcome-circle-2" />
                <div className="video-welcome-screen">
                  <span className="video-welcome-play">▶</span>
                  <span className="video-welcome-wave video-welcome-wave-1" />
                  <span className="video-welcome-wave video-welcome-wave-2" />
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="video-loading">
              <div className="video-spinner" />
              <p>Finding top videos for "{query}"…</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="video-error">
              <p>{error}</p>
            </div>
          )}

          {/* Results heading */}
          {!loading && searchedFor && videos.length > 0 && (
            <h2 className="video-results-heading animated-underline">
              Top {videos.length} results for: <span>{searchedFor}</span>
            </h2>
          )}

          {/* No results */}
          {!loading && hasSearched && !error && videos.length === 0 && (
            <p className="video-placeholder-text">
              No videos found for "{searchedFor}". Try a different search term.
            </p>
          )}

          {/* ── Video Cards ── */}
          <div className="video-cards-grid">
            {videos.map((video, index) => (
              <a
                key={video.id}
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="video-card"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                {/* Rank badge */}
                <div className="video-rank-badge">#{index + 1}</div>

                {/* Thumbnail */}
                <div className="video-thumb-wrapper">
                  {video.thumbnail ? (
                    <img src={video.thumbnail} alt={video.title} className="video-thumb" />
                  ) : (
                    <div className="video-thumb-placeholder">Play</div>
                  )}
                  <div className="video-play-overlay">Play</div>
                </div>

                {/* Info */}
                <div className="video-card-content">
                  <h3 className="video-card-title">{video.title}</h3>
                  <p className="video-card-channel">{video.channel}</p>
                  {video.description && (
                    <p className="video-card-desc">{video.description}</p>
                  )}
                  <p className="video-card-meta">
                    <span className="video-badge">Most Viewed</span>
                    {video.published && (
                      <span className="video-duration">{video.published}</span>
                    )}
                  </p>
                </div>

                <span className="video-card-glow" />
              </a>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
};

export default VideosPage;