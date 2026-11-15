import type { PubLocation } from '../types';
import type { VisitEditor } from '../hooks/useVisitEditor';
import { todayDate } from '../utils';
import { Modal } from './Modal';
import { VisitForm } from './VisitForm';

type VisitFormModalProps = {
  editor: VisitEditor;
  locations: PubLocation[];
  selectedId: number;
  onSelectPub: (pubId: number) => void;
};

/** The Add visit / Edit visit form, in a dialog */
export const VisitFormModal = ({ editor, locations, selectedId, onSelectPub }: VisitFormModalProps) => (
  <Modal title={editor.isEditing ? 'Edit visit' : 'Add visit'} onClose={editor.close}>
    <VisitForm
      locations={locations}
      selectedLocationId={selectedId}
      form={editor.form}
      setForm={editor.setForm}
      onLocationSelected={onSelectPub}
      onRatingUpdated={editor.setRating}
      onSubmit={editor.submit}
      isEditing={editor.isEditing}
      maxDate={todayDate()}
    />
  </Modal>
);
