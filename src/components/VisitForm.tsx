import React from 'react';
import StarRating from './StarRating';
import { SelectLocation } from './SelectLocation'; // 👈 Import your new component
import type { PubLocation } from '../types';
import './VisitForm.css';

type VisitFormProps = {
  locations: PubLocation[];
  selectedLocationId: number;
  form: { date: string; rating: number };
  setForm: React.Dispatch<
    React.SetStateAction<{ date: string; rating: number }>
  >;
  onSpoonsSelected: (evt: React.ChangeEvent<HTMLSelectElement>) => void;
  onRatingUpdated: (rating: number) => void;
  onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
};

export const VisitForm = ({
  locations,
  selectedLocationId,
  form,
  setForm,
  onSpoonsSelected,
  onRatingUpdated,
  onSubmit,
}: VisitFormProps) => {
  return (
    <form className="visit-form" onSubmit={onSubmit}>
      <SelectLocation
        locations={locations}
        selectedLocationId={selectedLocationId}
        onChange={onSpoonsSelected}
      />

      <label>
        Visit date
        <input
          type="date"
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

      <button type="submit">Save visit</button>
    </form>
  );
};
