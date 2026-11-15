import type { VisitEntry } from '../types';
import { ActionButton } from './ActionButton';
import { Modal } from './Modal';
import { VisitHistoryItem } from './visit/VisitHistoryItem';

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
export const VisitHistory = ({ pubName, visits, onAdd, onEdit, onDelete, onClose }: VisitHistoryProps) => (
  <Modal title={`Visits to ${pubName}`} onClose={onClose} className="visit-history">
    <ul className="visit-history-list">
      {visits.map((visit) => (
        <VisitHistoryItem key={visit.id} visit={visit} pubName={pubName} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </ul>
    <ActionButton onClick={onAdd}>Add another visit</ActionButton>
  </Modal>
);
