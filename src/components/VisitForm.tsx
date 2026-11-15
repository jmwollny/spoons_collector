import React, { useState } from 'react';
import StarRating from './StarRating';
import { SelectLocation } from './SelectLocation';
import { PhotoField } from './visit/PhotoField';
import type { PubLocation } from '../types';
import type { VisitFormState } from '../hooks/useVisitEditor';
import './VisitForm.css';

type VisitFormProps = {
  locations: PubLocation[];
  selectedLocationId: number;
  form: VisitFormState;
  setForm: React.Dispatch<React.SetStateAction<VisitFormState>>;
  onLocationSelected: (locationId: number) => void;
  onRatingUpdated: (rating: number) => void;
  onChoosePhoto: (photo: File) => void;
  onRemovePhoto: () => void;
  // The visit's saved photo, when editing one that has a photo
  savedPhotoUrl: string | null;
  onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
  // Editing an existing visit: its pub can't be changed
  isEditing?: boolean;
  isSaving?: boolean;
  error?: string | null;
  // Latest date that can be picked (today)
  maxDate?: string;
};

/** A visit: pub, date, rating, what was drunk, who with, notes and a photo */
export const VisitForm = ({
  locations,
  selectedLocationId,
  form,
  setForm,
  onLocationSelected,
  onRatingUpdated,
  onChoosePhoto,
  onRemovePhoto,
  savedPhotoUrl,
  onSubmit,
  isEditing = false,
  isSaving = false,
  error = null,
  maxDate,
}: VisitFormProps) => {
  const [hasMatchingPub, setHasMatchingPub] = useState(true);
  const setText = (field: 'drink' | 'company' | 'notes') => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { value } = event.target;
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <form className="visit-form" onSubmit={onSubmit}>
      <SelectLocation
        locations={locations}
        selectedLocationId={selectedLocationId}
        onSelect={onLocationSelected}
        onHasMatchesChange={setHasMatchingPub}
        disabled={isEditing}
      />

      <label>
        Visit date
        <input
          type="date"
          required
          max={maxDate}
          value={form.date}
          onChange={(event) => {
            const { value } = event.target;
            setForm((current) => ({ ...current, date: value }));
          }}
        />
      </label>

      <StarRating maxRating={3} rating={form.rating} onClicked={onRatingUpdated} />

      <div className="visit-form-row">
        <label>
          Drink
          <input
            type="text"
            value={form.drink}
            onChange={setText('drink')}
            placeholder="e.g. Abbot Ale"
            maxLength={80}
          />
        </label>
        <label>
          Who with
          <input
            type="text"
            value={form.company}
            onChange={setText('company')}
            placeholder="e.g. Sam and Alex"
            maxLength={80}
          />
        </label>
      </div>

      <label>
        Notes
        <textarea
          value={form.notes}
          onChange={setText('notes')}
          rows={2}
          maxLength={500}
          placeholder="Anything to remember"
        />
      </label>

      <PhotoField
        photo={form.photo}
        savedPhotoUrl={savedPhotoUrl}
        onChoose={onChoosePhoto}
        onRemove={onRemovePhoto}
      />

      {error && (
        <p className="near-me-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={!hasMatchingPub || isSaving}>
        {isSaving ? 'Saving…' : isEditing ? 'Save changes' : 'Save visit'}
      </button>
    </form>
  );
};
