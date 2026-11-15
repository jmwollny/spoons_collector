import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisitForm } from './VisitForm';
import { SelectLocation } from './SelectLocation';
import { samplePubs } from '../test/fixtures';

/** SelectLocation with its selection held in state, as the app does */
const Picker = ({ onSelect = vi.fn(), onHasMatchesChange = vi.fn(), disabled = false }) => {
  const [selected, setSelected] = useState(1);
  return (
    <SelectLocation
      locations={samplePubs}
      selectedLocationId={selected}
      disabled={disabled}
      onSelect={(id) => {
        setSelected(id);
        onSelect(id);
      }}
      onHasMatchesChange={onHasMatchesChange}
    />
  );
};

const options = () => screen.getAllByRole('option').map((option) => option.textContent);

describe('SelectLocation', () => {
  it('lists every pub A to Z, with its town', () => {
    render(<Picker />);
    expect(options()).toEqual([
      'The Counting House · Glasgow',
      'The Cuthbert Brodrick · Leeds',
      'The Hedley Verity · Leeds',
      'The Punch Bowl · York',
    ]);
    expect(screen.getByRole('combobox', { name: 'Pub' })).toHaveValue('1');
  });

  it('narrows the list as the user types, selecting the first match', async () => {
    const onSelect = vi.fn();
    render(<Picker onSelect={onSelect} />);
    await userEvent.type(screen.getByRole('searchbox'), 'york');
    expect(options()).toEqual(['The Punch Bowl · York']);
    expect(onSelect).toHaveBeenLastCalledWith(3);
  });

  it("keeps the selection when it's still in the list", async () => {
    const onSelect = vi.fn();
    render(<Picker onSelect={onSelect} />);
    await userEvent.type(screen.getByRole('searchbox'), 'leeds');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('says when nothing matches, and reports it', async () => {
    const onHasMatchesChange = vi.fn();
    render(<Picker onHasMatchesChange={onHasMatchesChange} />);
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.getByText('No pubs match “zzz”.')).toBeInTheDocument();
    expect(onHasMatchesChange).toHaveBeenLastCalledWith(false);
  });

  it('picks from the list', async () => {
    const onSelect = vi.fn();
    render(<Picker onSelect={onSelect} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), '4');
    expect(onSelect).toHaveBeenCalledWith(4);
  });

  it("doesn't submit a form when Enter is pressed in the search", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Picker />
      </form>,
    );
    await userEvent.type(screen.getByRole('searchbox'), 'leeds{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('when disabled, shows the pub without a search', () => {
    render(<Picker disabled />);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});

/** VisitForm with its form state held in state, as the app does */
const Form = ({ isEditing = false, onSubmit = vi.fn() }) => {
  const [form, setForm] = useState({ date: '2026-11-15', rating: -1 });
  return (
    <VisitForm
      locations={samplePubs}
      selectedLocationId={1}
      form={form}
      setForm={setForm}
      onLocationSelected={vi.fn()}
      onRatingUpdated={(rating) => setForm((current) => ({ ...current, rating }))}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
      isEditing={isEditing}
      maxDate="2026-11-15"
    />
  );
};

describe('VisitForm', () => {
  it('saves the pub, date and rating chosen', async () => {
    const onSubmit = vi.fn();
    render(<Form onSubmit={onSubmit} />);
    const date = screen.getByLabelText('Visit date');
    expect(date).toHaveAttribute('max', '2026-11-15');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-11-01');
    await userEvent.click(screen.getByRole('button', { name: 'Rate 2 out of 3' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save visit' }));
    expect(onSubmit).toHaveBeenCalledWith({ date: '2026-11-01', rating: 1 });
  });

  it("can't be saved for a pub that isn't shown", async () => {
    render(<Form />);
    await userEvent.type(screen.getByRole('searchbox'), 'nowhere');
    expect(screen.getByRole('button', { name: 'Save visit' })).toBeDisabled();
  });

  it('when editing, keeps the pub and says Save changes', () => {
    render(<Form isEditing />);
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });
});
