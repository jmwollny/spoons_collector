import React, { useState } from 'react';
import StarRating from './StarRating';
import { SelectLocation } from './SelectLocation';
import type { PubLocation } from '../types';
import './VisitForm.css';

type VisitFormProps = {
  locations: PubLocation[];
  selectedLocationId: number;
  form: { date: string; rating: number };
  setForm: React.Dispatch<
    React.SetStateAction<{ date: string; rating: number }>
  >;
  onLocationSelected: (locationId: number) => void;
  onRatingUpdated: (rating: number) => void;
  onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
  // Editing an existing visit: its pub can't be changed
  isEditing?: boolean;
  // Latest date that can be picked (today)
  maxDate?: string;
};

export const VisitForm = ({
  locations,
  selectedLocationId,
  form,
  setForm,
  onLocationSelected,
  onRatingUpdated,
  onSubmit,
  isEditing = false,
  maxDate,
}: VisitFormProps) => {
  const [hasMatchingPub, setHasMatchingPub] = useState(true);

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
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              date: event.target.value,
            }))
          }
        />
      </label>

      <StarRating
        maxRating={3}
        rating={form.rating}
        onClicked={onRatingUpdated}
      />

      <button type="submit" disabled={!hasMatchingPub}>{isEditing ? 'Save changes' : 'Save visit'}</button>
    </form>
  );
};
