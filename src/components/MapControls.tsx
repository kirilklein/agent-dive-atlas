type Props = {
  canZoomIn: boolean;
  canZoomOut: boolean;
  canRecenter: boolean;
  recenterLabel: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
};

export function MapControls({ canZoomIn, canZoomOut, canRecenter, recenterLabel, onZoomIn, onZoomOut, onRecenter }: Props) {
  return (
    <div className="map-controls" role="group" aria-label="Map controls">
      <button type="button" className="map-ctl" onClick={onZoomIn} disabled={!canZoomIn} aria-label="Zoom in" title="Zoom in (+)">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
      <button type="button" className="map-ctl" onClick={onZoomOut} disabled={!canZoomOut} aria-label="Zoom out" title="Zoom out (−)">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
      <button
        type="button"
        className="map-ctl map-ctl--recenter"
        onClick={onRecenter}
        disabled={!canRecenter}
        aria-label={recenterLabel}
        title={`${recenterLabel} (0)`}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <circle cx="8" cy="8" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="8" r="1.3" fill="currentColor" />
          <path d="M8 1v2.6M8 12.4V15M1 8h2.6M12.4 8H15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
