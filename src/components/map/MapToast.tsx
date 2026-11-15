import { useState } from 'react';

/**
 * A message on the map, e.g. a location error, with a ✕ to close it. Once
 * closed it stays closed until a different message arrives.
 */
export const MapToast = ({ message }: { message: string | null }) => {
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (!message || message === dismissed) return null;
  return (
    <div className="map-toast" role="alert">
      <span>{message}</span>
      <button type="button" onClick={() => setDismissed(message)} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
};
