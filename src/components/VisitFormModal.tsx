import type { PubLocation } from '../types';
import type { VisitEditor } from '../hooks/useVisitEditor';
import { usePhotoUrl } from '../hooks/usePhotoUrl';
import { shrinkPhoto } from '../photos';
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
export const VisitFormModal = ({ editor, locations, selectedId, onSelectPub }: VisitFormModalProps) => {
  const savedPhotoUrl = usePhotoUrl(editor.editingVisit?.id ?? null, editor.editingVisit?.hasPhoto);
  return (
    <Modal title={editor.isEditing ? 'Edit visit' : 'Add visit'} onClose={editor.close}>
      <VisitForm
        locations={locations}
        selectedLocationId={selectedId}
        form={editor.form}
        setForm={editor.setForm}
        onLocationSelected={onSelectPub}
        onRatingUpdated={editor.setRating}
        // Camera photos are large: shrink them before keeping them
        onChoosePhoto={async (photo) => editor.choosePhoto(await shrinkPhoto(photo))}
        onRemovePhoto={editor.removePhoto}
        savedPhotoUrl={savedPhotoUrl}
        onSubmit={editor.submit}
        isEditing={editor.isEditing}
        isSaving={editor.isSaving}
        error={editor.saveError}
        maxDate={todayDate()}
      />
    </Modal>
  );
};
