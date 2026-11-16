import type { PendingRestore } from '../../hooks/useBackupRestore';
import { plural } from '../../utils';
import { ConfirmDialog } from '../ConfirmDialog';

type RestoreConfirmDialogProps = {
  restore: PendingRestore;
  // How many visits are here already
  currentCount: number;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Says what restoring a backup will add, and asks to go ahead */
export const RestoreConfirmDialog = ({
  restore,
  currentCount,
  onConfirm,
  onCancel,
}: RestoreConfirmDialogProps) => (
  <ConfirmDialog
    title="Restore visits?"
    message={
      <>
        The backup has {plural(restore.fileCount, 'visit')}. {plural(restore.addedCount, 'visit')}{' '}
        will be added to the {plural(currentCount, 'visit')} already here. Nothing here is removed or
        changed.
        {restore.crawl &&
          ` It also has a crawl of ${plural(restore.crawl.stops.length, 'pub')} from ${restore.crawl.startLabel}, which will be restored too.`}
        {restore.crawlSkipped && " Its crawl isn't restored, as you have one under way."}
        {restore.newCrawlHistory.length > 0 &&
          ` It also has ${plural(restore.newCrawlHistory.length, 'finished crawl')}, for your achievements.`}
        {Object.keys(restore.photos).length > 0 &&
          ` ${plural(Object.keys(restore.photos).length, 'photo')} will be restored too.`}
      </>
    }
    confirmLabel="Restore"
    onConfirm={onConfirm}
    onCancel={onCancel}
  />
);
