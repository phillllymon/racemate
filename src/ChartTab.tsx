import { useState, useEffect } from "react";

interface Position {
  lat: number;
  lng: number;
}

export default function ChartTab() {
  const [position, setPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not available");
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setError(null);
      },
      (err) => {
        setError(err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(id);
    };
  }, []);

  return (
    <div className="chart-tab">
      <div className="chart-position">
        {error && (
          <div className="chart-error">{error}</div>
        )}
        {position && (
          <div className="chart-coords">
            <div className="chart-coord-row">
              <span className="chart-coord-label">LAT</span>
              <span className="chart-coord-value">{position.lat.toFixed(6)}°</span>
            </div>
            <div className="chart-coord-row">
              <span className="chart-coord-label">LON</span>
              <span className="chart-coord-value">{position.lng.toFixed(6)}°</span>
            </div>
          </div>
        )}
        {!position && !error && (
          <div className="chart-loading">Acquiring position...</div>
        )}
      </div>

      <div className="chart-map-placeholder">
        {position ? (
          <div className="chart-map-dot">
            <div className="chart-map-dot-inner" />
            <div className="chart-map-dot-ring" />
          </div>
        ) : (
          <span className="chart-map-text">Map will appear here</span>
        )}
      </div>

      <p className="chart-hint">
        Google Maps integration coming soon
      </p>
    </div>
  );
}
