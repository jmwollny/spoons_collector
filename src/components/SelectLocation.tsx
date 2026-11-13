import React from 'react';
import type { PubLocation } from '../types';
import './SelectLocation.css';

type SelectLocationProps = {
  locations: PubLocation[];
  selectedLocationId: number | string;
  label?: string;
  disabled?: boolean;
  onChange: (evt: React.ChangeEvent<HTMLSelectElement>) => void;
};

export const SelectLocation = ({
  locations,
  selectedLocationId,
  disabled = false,
  onChange,
}: SelectLocationProps) => {
  const renderSelect = () => {
    return (
      <select value={selectedLocationId} onChange={onChange} disabled={disabled}>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name} · {location.city}
          </option>
        ))}
      </select>
    );
  };
  return (
    <label>
      {renderSelect()}
    </label>
  );
};
