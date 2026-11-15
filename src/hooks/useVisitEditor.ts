import { useState } from 'react';
import type { VisitDetails, VisitEntry } from '../types';
import { todayDate } from '../utils';
import { deletePhoto, savePhoto } from '../photos';
import type { VisitsApi } from './useVisits';

/**
 * The photo while the form is open. Nothing is saved or deleted until the
 * form is, so closing it leaves the visit's photo as it was.
 */
export type PhotoDraft =
  | { kind: 'none' }
  // The visit's saved photo, unchanged
  | { kind: 'kept' }
  | { kind: 'new'; blob: Blob; previewUrl: string }
  | { kind: 'removed' };

export type VisitFormState = {
  date: string;
  rating: number;
  drink: string;
  company: string;
  notes: string;
  photo: PhotoDraft;
};

const blankForm = (): VisitFormState => ({
  date: todayDate(),
  rating: -1,
  drink: '',
  company: '',
  notes: '',
  photo: { kind: 'none' },
});

// Leaves out empty text, so visits without notes don't carry empty fields
const textOrUndefined = (text: string) => text.trim() || undefined;

/** The Add visit / Edit visit form */
export const useVisitEditor = (selectedId: number, visitsApi: VisitsApi) => {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<VisitFormState>(blankForm);
  // The visit being edited, or null when adding a new one
  const [editing, setEditing] = useState<VisitEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const releasePreview = (photo: PhotoDraft) => {
    if (photo.kind === 'new') URL.revokeObjectURL(photo.previewUrl);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(blankForm());
    setSaveError(null);
    setIsOpen(true);
  };

  // Opens the form filled in with one of the selected pub's visits
  const openEdit = (visit: VisitEntry) => {
    setEditing(visit);
    setForm({
      date: visit.date,
      rating: visit.rating,
      drink: visit.drink ?? '',
      company: visit.company ?? '',
      notes: visit.notes ?? '',
      photo: visit.hasPhoto ? { kind: 'kept' } : { kind: 'none' },
    });
    setSaveError(null);
    setIsOpen(true);
  };

  const close = () => {
    releasePreview(form.photo);
    setIsOpen(false);
    setEditing(null);
    setForm(blankForm());
  };

  /** A photo chosen or taken for this visit */
  const choosePhoto = (blob: Blob) => {
    releasePreview(form.photo);
    setForm((current) => ({ ...current, photo: { kind: 'new', blob, previewUrl: URL.createObjectURL(blob) } }));
  };

  const removePhoto = () => {
    releasePreview(form.photo);
    setForm((current) => ({
      ...current,
      photo: editing?.hasPhoto ? { kind: 'removed' } : { kind: 'none' },
    }));
  };

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId || !form.date || isSaving) {
      return;
    }
    const visitId = editing?.id ?? `${selectedId}-${Date.now()}`;
    setIsSaving(true);
    setSaveError(null);
    try {
      let hasPhoto = Boolean(editing?.hasPhoto);
      if (form.photo.kind === 'new') {
        await savePhoto(visitId, form.photo.blob);
        hasPhoto = true;
      } else if (form.photo.kind === 'removed') {
        await deletePhoto(visitId);
        hasPhoto = false;
      }
      const details: VisitDetails = {
        date: form.date,
        rating: form.rating,
        drink: textOrUndefined(form.drink),
        company: textOrUndefined(form.company),
        notes: textOrUndefined(form.notes),
        hasPhoto: hasPhoto || undefined,
      };
      if (editing) {
        visitsApi.updateVisit(visitId, details);
      } else {
        visitsApi.addVisit({ id: visitId, locationId: selectedId, ...details });
      }
      close();
    } catch (error) {
      setSaveError(`Couldn't save the photo: ${error instanceof Error ? error.message : error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const setRating = (rating: number) => setForm((current) => ({ ...current, rating }));

  return {
    isOpen,
    isEditing: editing !== null,
    // The visit being edited, for its saved photo
    editingVisit: editing,
    form,
    setForm,
    setRating,
    choosePhoto,
    removePhoto,
    isSaving,
    saveError,
    openAdd,
    openEdit,
    close,
    submit,
  };
};

export type VisitEditor = ReturnType<typeof useVisitEditor>;
