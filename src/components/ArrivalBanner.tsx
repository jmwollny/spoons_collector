import type { PubLocation } from '../types';
import './ArrivalBanner.css';

type ArrivalBannerProps = {
  pub: PubLocation;
  // When the pub is a stop on the crawl under way: which one, of how many
  crawlStop?: { number: number; of: number };
  // Shows the pub on the map
  onShow: () => void;
  onCheckIn: () => void;
  onDismiss: () => void;
};

/** Pops up when live location finds the user at a Wetherspoon */
export const ArrivalBanner = ({ pub, crawlStop, onShow, onCheckIn, onDismiss }: ArrivalBannerProps) => (
  <div className="arrival-banner" role="status">
    <button type="button" className="arrival-banner-text" onClick={onShow}>
      <span className="arrival-banner-pin" aria-hidden="true">
        📍
      </span>
      <span>
        {crawlStop ? (
          <>
            You've reached stop {crawlStop.number} of {crawlStop.of}
            <strong>{pub.name}</strong>
          </>
        ) : (
          <>
            You're at
            <strong>{pub.name}</strong>
          </>
        )}
      </span>
    </button>
    <button type="button" className="arrival-banner-check-in" onClick={onCheckIn}>
      Check in
    </button>
    <button type="button" className="arrival-banner-dismiss" onClick={onDismiss} aria-label="Dismiss">
      ✕
    </button>
  </div>
);
