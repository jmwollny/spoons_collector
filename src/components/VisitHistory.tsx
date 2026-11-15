import type { VisitEntry } from '../types';
import { formatDate } from '../utils';
import { ActionButton } from './ActionButton';
import StarRating from './StarRating';
import { Modal } from './Modal';

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
  return (
    <Modal title={`Visits to ${pubName}`} onClose={onClose} className="visit-history">
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
    </Modal>
  );
};
