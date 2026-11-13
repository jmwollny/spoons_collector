import { useEffect } from 'react';
import type { VisitEntry } from '../types';
import { formatDate } from '../utils';
import { ActionButton } from './ActionButton';
import StarRating from './StarRating';

type VisitHistoryProps = {
  pubName: string;
  // Newest first
  visits: VisitEntry[];
  onAdd: () => void;
  onEdit: (visit: VisitEntry) => void;
  onDelete: (visit: VisitEntry) => void;
  onClose: () => void;
};

/** Every visit to one pub, each with its own Edit and Delete */
export const VisitHistory = ({
  pubName,
  visits,
  onAdd,
  onEdit,
  onDelete,
  onClose,
}: VisitHistoryProps) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="visit-form-modal-backdrop" onClick={onClose}>
      <div
        className="visit-form-modal visit-history"
        role="dialog"
        aria-modal="true"
        aria-labelledby="visit-history-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="visit-form-modal-header">
          <h2 id="visit-history-title">Visits to {pubName}</h2>
          <button type="button" className="visit-form-close" onClick={onClose}>
            Close
          </button>
        </div>

        <ul className="visit-history-list">
          {visits.map((visit) => (
            <li key={visit.id}>
              <div className="visit-history-details">
                <strong>{formatDate(visit.date)}</strong>
                <StarRating rating={visit.rating} maxRating={3} disabled={true} size={16} />
              </div>
              <div className="visit-history-actions">
                <button type="button" className="visit-form-close" onClick={() => onEdit(visit)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="visit-history-delete"
                  onClick={() => onDelete(visit)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>

        <ActionButton onClick={onAdd}>Add another visit</ActionButton>
      </div>
    </div>
  );
};
