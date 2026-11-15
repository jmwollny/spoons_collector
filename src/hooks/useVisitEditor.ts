import { useState } from 'react';
import type { VisitEntry } from '../types';
import { todayDate } from '../utils';
import type { VisitsApi } from './useVisits';

export type VisitFormState = { date: string; rating: number };

const blankForm = (): VisitFormState => ({ date: todayDate(), rating: -1 });

/** The Add visit / Edit visit form */
export const useVisitEditor = (selectedId: number, visitsApi: VisitsApi) => {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<VisitFormState>(blankForm);
  // The visit being edited, or null when adding a new one
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);

  const openAdd = () => {
    setEditingVisitId(null);
    setForm(blankForm());
    setIsOpen(true);
  };

  // Opens the form filled in with one of the selected pub's visits
  const openEdit = (visit: VisitEntry) => {
    setEditingVisitId(visit.id);
    setForm({ date: visit.date, rating: visit.rating });
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setEditingVisitId(null);
    setForm(blankForm());
  };

  const submit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId || !form.date) {
      return;
    }
    if (editingVisitId) {
      visitsApi.updateVisit(editingVisitId, form.date, form.rating);
    } else {
      visitsApi.addVisit(selectedId, form.date, form.rating);
    }
    close();
  };

  const setRating = (rating: number) => setForm((current) => ({ ...current, rating }));

  return {
    isOpen,
    isEditing: editingVisitId !== null,
    form,
    setForm,
    setRating,
    openAdd,
    openEdit,
    close,
    submit,
  };
};

export type VisitEditor = ReturnType<typeof useVisitEditor>;
