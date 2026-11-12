import React from 'react';
import type { PubLocation } from '../types';
import './SelectLocation.css';

type SelectLocationProps = {
  locations: PubLocation[];
  selectedLocationId: number | string;
  label?: string;
  onChange: (evt: React.ChangeEvent<HTMLSelectElement>) => void;
};

export const SelectLocation = ({
  locations,
  selectedLocationId,
  onChange,
}: SelectLocationProps) => {
  const renderSelect = () => {
    return (
      <select value={selectedLocationId} onChange={onChange}>
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
