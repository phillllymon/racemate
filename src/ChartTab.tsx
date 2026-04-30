import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ---- Race mark type ----

interface RaceMark {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

// ---- Tile layer configs ----

const LAYERS = {
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://openstreetmap.org">OSM</a>',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com">Esri</a>',
  },
  openseamap: {
    url: "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://openseamap.org">OpenSeaMap</a>',
  },
  noaa: {
    url: "https://tileservice.charts.noaa.gov/tiles/50000_1/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://noaa.gov">NOAA</a>',
  },
};

type BaseLayer = "osm" | "satellite";

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---- Custom position icon (SVG) ----

function createPositionIcon(): L.DivIcon {
  return L.divIcon({
    className: "chart-position-marker",
    html: `
      <div class="chart-pos-dot">
        <div class="chart-pos-dot-inner"></div>
        <div class="chart-pos-dot-ring"></div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function createMarkIcon(label: string): L.DivIcon {
  return L.divIcon({
    className: "chart-mark-icon",
    html: `<div class="chart-mark-pin"><span>${label}</span></div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  });
}

// ---- Component ----

export default function ChartTab() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const positionMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const seamapLayerRef = useRef<L.TileLayer | null>(null);
  const noaaLayerRef = useRef<L.TileLayer | null>(null);
  const markMarkersRef = useRef<Map<string, L.Marker>>(new Map());

  const [position, setPosition] = useState<{ lat: number; lng: number; accuracy: number; heading: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [baseLayer, setBaseLayer] = useState<BaseLayer>("osm");
  const [showSeamap, setShowSeamap] = useState(true);
  const [showNoaa, setShowNoaa] = useState(false);
  const [followPosition, setFollowPosition] = useState(true);
  const [marks, setMarks] = useState<RaceMark[]>([]);
  const [addingMark, setAddingMark] = useState(false);
  const [newMarkLabel, setNewMarkLabel] = useState("");
  const hasInitialCenter = useRef(false);

  // ---- Initialize map ----
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [45.5, -73.6], // Default: Montreal
      zoom: 14,
      zoomControl: false,
    });

    // Add zoom control to bottom right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Base layer
    const base = L.tileLayer(LAYERS.osm.url, {
      attribution: LAYERS.osm.attribution,
      maxZoom: 18,
    }).addTo(map);
    baseLayerRef.current = base;

    // OpenSeaMap overlay
    const seamap = L.tileLayer(LAYERS.openseamap.url, {
      attribution: LAYERS.openseamap.attribution,
      maxZoom: 18,
      opacity: 0.8,
    }).addTo(map);
    seamapLayerRef.current = seamap;

    mapInstanceRef.current = map;

    // Handle map drag to disable follow
    map.on("dragstart", () => {
      setFollowPosition(false);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ---- Watch GPS position ----
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not available");
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
        });
        setError(null);
      },
      (err) => {
        setError(err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // ---- Update position marker ----
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !position) return;

    const latlng: L.LatLngExpression = [position.lat, position.lng];

    // Position marker
    if (!positionMarkerRef.current) {
      positionMarkerRef.current = L.marker(latlng, {
        icon: createPositionIcon(),
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      positionMarkerRef.current.setLatLng(latlng);
    }

    // Accuracy circle
    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = L.circle(latlng, {
        radius: position.accuracy,
        color: "#4a90c4",
        fillColor: "#4a90c4",
        fillOpacity: 0.1,
        weight: 1,
      }).addTo(map);
    } else {
      accuracyCircleRef.current.setLatLng(latlng);
      accuracyCircleRef.current.setRadius(position.accuracy);
    }

    // Center map on first position or when following
    if (!hasInitialCenter.current || followPosition) {
      map.setView(latlng, hasInitialCenter.current ? map.getZoom() : 15);
      hasInitialCenter.current = true;
    }
  }, [position, followPosition]);

  // ---- Switch base layer ----
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
    }

    const config = LAYERS[baseLayer];
    const layer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: 18,
    }).addTo(map);
    layer.bringToBack();
    baseLayerRef.current = layer;
  }, [baseLayer]);

  // ---- Toggle OpenSeaMap ----
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (showSeamap && !seamapLayerRef.current) {
      const layer = L.tileLayer(LAYERS.openseamap.url, {
        attribution: LAYERS.openseamap.attribution,
        maxZoom: 18,
        opacity: 0.8,
      }).addTo(map);
      seamapLayerRef.current = layer;
    } else if (!showSeamap && seamapLayerRef.current) {
      map.removeLayer(seamapLayerRef.current);
      seamapLayerRef.current = null;
    }
  }, [showSeamap]);

  // ---- Toggle NOAA ----
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (showNoaa && !noaaLayerRef.current) {
      const layer = L.tileLayer(LAYERS.noaa.url, {
        attribution: LAYERS.noaa.attribution,
        maxZoom: 18,
        opacity: 0.7,
      }).addTo(map);
      noaaLayerRef.current = layer;
    } else if (!showNoaa && noaaLayerRef.current) {
      map.removeLayer(noaaLayerRef.current);
      noaaLayerRef.current = null;
    }
  }, [showNoaa]);

  // ---- Sync race marks on map ----
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove stale markers
    markMarkersRef.current.forEach((marker, id) => {
      if (!marks.find((m) => m.id === id)) {
        map.removeLayer(marker);
        markMarkersRef.current.delete(id);
      }
    });

    // Add/update markers
    marks.forEach((mark) => {
      const existing = markMarkersRef.current.get(mark.id);
      if (existing) {
        existing.setLatLng([mark.lat, mark.lng]);
      } else {
        const marker = L.marker([mark.lat, mark.lng], {
          icon: createMarkIcon(mark.label),
          draggable: true,
        }).addTo(map);

        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          setMarks((prev) =>
            prev.map((m) => m.id === mark.id ? { ...m, lat: pos.lat, lng: pos.lng } : m)
          );
        });

        markMarkersRef.current.set(mark.id, marker);
      }
    });
  }, [marks]);

  // ---- Add mark at current position ----
  const addMarkAtPosition = useCallback(() => {
    if (!position) return;
    const label = newMarkLabel.trim() || `M${marks.length + 1}`;
    setMarks((prev) => [...prev, {
      id: generateId(),
      lat: position.lat,
      lng: position.lng,
      label,
    }]);
    setNewMarkLabel("");
    setAddingMark(false);
  }, [position, newMarkLabel, marks.length]);

  // ---- Add mark at map center ----
  const addMarkAtCenter = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const center = map.getCenter();
    const label = newMarkLabel.trim() || `M${marks.length + 1}`;
    setMarks((prev) => [...prev, {
      id: generateId(),
      lat: center.lat,
      lng: center.lng,
      label,
    }]);
    setNewMarkLabel("");
    setAddingMark(false);
  }, [newMarkLabel, marks.length]);

  const removeMark = useCallback((id: string) => {
    setMarks((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const recenter = useCallback(() => {
    if (!position || !mapInstanceRef.current) return;
    mapInstanceRef.current.setView([position.lat, position.lng], mapInstanceRef.current.getZoom());
    setFollowPosition(true);
  }, [position]);

  return (
    <div className="chart-tab-full">
      {/* Map container */}
      <div className="chart-map-container" ref={mapRef} />

      {/* Center crosshairs */}
      <div className="chart-crosshairs" aria-hidden="true">
        <div className="chart-crosshair-v" />
        <div className="chart-crosshair-h" />
        <div className="chart-crosshair-dot" />
      </div>

      {/* Position info overlay */}
      <div className="chart-info-overlay">
        {error && <div className="chart-error">{error}</div>}
        {position && (
          <div className="chart-coords-compact">
            <span>{position.lat.toFixed(5)}°</span>
            <span>{position.lng.toFixed(5)}°</span>
            <span>±{position.accuracy < 1000 ? `${Math.round(position.accuracy)}m` : `${(position.accuracy / 1000).toFixed(1)}km`}</span>
          </div>
        )}
        {!position && !error && <div className="chart-loading">Acquiring GPS...</div>}
      </div>

      {/* Recenter button */}
      {!followPosition && position && (
        <button className="chart-recenter-btn" onClick={recenter} aria-label="Recenter">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        </button>
      )}

      {/* Controls panel */}
      <div className="chart-controls">
        {/* Layer toggles */}
        <div className="chart-layer-toggles">
          <button
            className={`chart-layer-btn ${baseLayer === "osm" ? "chart-layer-btn--active" : ""}`}
            onClick={() => setBaseLayer("osm")}
          >
            Map
          </button>
          <button
            className={`chart-layer-btn ${baseLayer === "satellite" ? "chart-layer-btn--active" : ""}`}
            onClick={() => setBaseLayer("satellite")}
          >
            Satellite
          </button>
          <button
            className={`chart-layer-btn ${showSeamap ? "chart-layer-btn--active" : ""}`}
            onClick={() => setShowSeamap(!showSeamap)}
          >
            Sea Marks
          </button>
          <button
            className={`chart-layer-btn ${showNoaa ? "chart-layer-btn--active" : ""}`}
            onClick={() => setShowNoaa(!showNoaa)}
          >
            NOAA
          </button>
        </div>

        {/* Race marks */}
        {marks.length > 0 && (
          <div className="chart-marks-list">
            {marks.map((m) => (
              <div key={m.id} className="chart-mark-row">
                <span className="chart-mark-label">{m.label}</span>
                <span className="chart-mark-coords">{m.lat.toFixed(5)}, {m.lng.toFixed(5)}</span>
                <button className="chart-mark-remove" onClick={() => removeMark(m.id)}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Add mark */}
        {addingMark ? (
          <div className="chart-add-mark-form">
            <input
              className="login-input chart-mark-input"
              placeholder="Mark name (optional)"
              value={newMarkLabel}
              onChange={(e) => setNewMarkLabel(e.target.value)}
            />
            <div className="chart-add-mark-actions">
              <button className="btn btn-primary btn-sm" onClick={addMarkAtPosition} disabled={!position}>
                At My Position
              </button>
              <button className="btn btn-secondary btn-sm" onClick={addMarkAtCenter}>
                At Map Center
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setAddingMark(false); setNewMarkLabel(""); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={() => setAddingMark(true)}>
            + Drop Mark
          </button>
        )}
      </div>
    </div>
  );
}
