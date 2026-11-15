import { useState } from 'react';
import type { VisitEntry } from '../../types';
import { formatDate } from '../../utils';
import { usePhotoUrl } from '../../hooks/usePhotoUrl';
import StarRating from '../StarRating';
import { Modal } from '../Modal';

type VisitHistoryItemProps = {
  visit: VisitEntry;
  pubName: string;
  onEdit: (visit: VisitEntry) => void;
  onDelete: (visit: VisitEntry) => void;
};

/** One visit: date, rating, drink, company, notes and photo */
export const VisitHistoryItem = ({ visit, pubName, onEdit, onDelete }: VisitHistoryItemProps) => {
  const photoUrl = usePhotoUrl(visit.id, visit.hasPhoto);
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const date = formatDate(visit.date);
  const extras = [
    visit.drink && `🍺 ${visit.drink}`,
    visit.company && `👥 ${visit.company}`,
  ].filter(Boolean);

  return (
    <li className="visit-history-item">
      <div className="visit-history-main">
        {photoUrl && (
          <button
            type="button"
            className="visit-history-photo"
            onClick={() => setIsPhotoOpen(true)}
            aria-label={`Photo from ${date}`}
          >
            <img src={photoUrl} alt="" />
          </button>
        )}
        <div className="visit-history-details">
          <strong>{date}</strong>
          <StarRating rating={visit.rating} maxRating={3} disabled={true} size={16} />
          {extras.length > 0 && <span className="visit-history-extras">{extras.join(' · ')}</span>}
          {visit.notes && <p className="visit-history-notes">{visit.notes}</p>}
        </div>
      </div>
      <div className="visit-history-actions">
        <button type="button" className="visit-form-close" onClick={() => onEdit(visit)}>
          Edit
        </button>
        <button type="button" className="visit-history-delete" onClick={() => onDelete(visit)}>
          Delete
        </button>
      </div>

      {isPhotoOpen && photoUrl && (
        <Modal title={`${pubName}, ${date}`} onClose={() => setIsPhotoOpen(false)} className="visit-photo-dialog">
          <img className="visit-photo-full" src={photoUrl} alt={`At ${pubName} on ${date}`} />
        </Modal>
      )}
    </li>
  );
};
