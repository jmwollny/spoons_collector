import type { Release } from '../appUpdate';

type UpdateNoticeProps = {
  update: Release;
  onDismiss: () => void;
};

/** Says a newer version of the app is out, with a link to get it */
export const UpdateNotice = ({ update, onDismiss }: UpdateNoticeProps) => (
  <div className="backup-reminder update-notice" role="status">
    <p>
      <span aria-hidden="true">🎉 </span>
      Version {update.version} of Spoons Collector is out.
    </p>
    <div className="backup-reminder-actions">
      <a className="backup-reminder-now" href={update.url} target="_blank" rel="noopener noreferrer">
        Get it
      </a>
      <button type="button" className="visit-form-close" onClick={onDismiss}>
        Not now
      </button>
    </div>
  </div>
);
