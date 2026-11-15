import { useId } from 'react';
import type { PhotoDraft } from '../../hooks/useVisitEditor';

type PhotoFieldProps = {
  photo: PhotoDraft;
  // The visit's saved photo, when editing one that has a photo
  savedPhotoUrl: string | null;
  onChoose: (photo: File) => void;
  onRemove: () => void;
};

/**
 * Adds a photo to a visit. On a phone, choosing a photo offers the camera
 * as well as the gallery.
 */
export const PhotoField = ({ photo, savedPhotoUrl, onChoose, onRemove }: PhotoFieldProps) => {
  const inputId = useId();
  const previewUrl =
    photo.kind === 'new' ? photo.previewUrl : photo.kind === 'kept' ? savedPhotoUrl : null;
  const hasPhoto = photo.kind === 'new' || photo.kind === 'kept';

  return (
    <div className="photo-field">
      <span className="photo-field-label">Photo</span>
      {hasPhoto && previewUrl && (
        <img className="photo-field-preview" src={previewUrl} alt="This visit's photo" />
      )}
      <div className="photo-field-actions">
        <label htmlFor={inputId} className="photo-field-choose">
          📷 {hasPhoto ? 'Change photo' : 'Add photo'}
        </label>
        <input
          id={inputId}
          className="photo-field-input"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Reset so choosing the same photo again still counts
            event.target.value = '';
            if (file) onChoose(file);
          }}
        />
        {hasPhoto && (
          <button type="button" className="photo-field-remove" onClick={onRemove}>
            Remove photo
          </button>
        )}
      </div>
    </div>
  );
};
