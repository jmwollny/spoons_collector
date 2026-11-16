import { useEffect, useRef, useState } from 'react';
import type { VisitEntry } from '../types';
import type { BackupControls } from '../backupReminder';
import type { Crawl } from '../crawl';
import type { CompletedCrawl } from '../crawlScore';
import { useBackupRestore } from '../hooks/useBackupRestore';
import { useDismiss } from '../hooks/useDismiss';
import { formatDate } from '../utils';
import { RestoreConfirmDialog } from './backup/RestoreConfirmDialog';
import './AppMenu.css';

type AppMenuProps = {
  visits: VisitEntry[];
  onVisitsChange: (visits: VisitEntry[]) => void;
  // The crawl under way, if any
  crawl: Crawl | null;
  // Checks a crawl from a backup file; null if it isn't usable
  prepareCrawl: (value: unknown) => Crawl | null;
  onCrawlRestore: (crawl: Crawl) => void;
  backup: BackupControls;
  crawlHistory: CompletedCrawl[];
  onCrawlHistoryRestore: (crawls: CompletedCrawl[]) => void;
  // Live location: spotting when the user is at a Wetherspoon
  isLiveLocationOn: boolean;
  onToggleLiveLocation: () => void;
};

// How long a "Backed up…" or "Restored…" note shows for
const STATUS_MS = 6000;

/**
 * The ☰ menu in the top-right corner: live location, and backing up visits
 * (and any crawl under way) to a file and restoring them from one. Visits
 * otherwise live only on this browser or phone.
 */
export const AppMenu = (props: AppMenuProps) => {
  const { visits, crawl, backup } = props;
  const restore = useBackupRestore(props);
  const [isOpen, setIsOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const close = () => setIsOpen(false);

  // Escape or Back closes the menu; so does a click anywhere else
  useDismiss(close, isOpen);
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  // A success note goes by itself; an error stays until dismissed
  const { status, clearStatus } = restore;
  useEffect(() => {
    if (status?.kind !== 'success') return;
    const timer = window.setTimeout(clearStatus, STATUS_MS);
    return () => window.clearTimeout(timer);
  }, [status, clearStatus]);

  const backUp = () => {
    close();
    void restore.backUp();
  };

  const chooseFile = () => {
    close();
    fileInput.current?.click();
  };

  return (
    <div className="app-menu" ref={menu}>
      <button
        type="button"
        className="app-menu-button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="app-menu-panel"
        aria-label="Menu"
      >
        <span aria-hidden="true">☰</span>
      </button>

      {isOpen && (
        <div id="app-menu-panel" className="app-menu-panel">
          {/* Stays open, so the user sees the switch change */}
          <button
            type="button"
            role="switch"
            className={`app-menu-switch ${props.isLiveLocationOn ? 'is-on' : ''}`}
            aria-checked={props.isLiveLocationOn}
            onClick={props.onToggleLiveLocation}
          >
            <span>📍 Live location</span>
            <span className="app-menu-switch-state">{props.isLiveLocationOn ? 'On' : 'Off'}</span>
          </button>
          <p className="app-menu-hint">Spots when you're at a Wetherspoon, while the app is open.</p>
          <hr className="app-menu-divider" />
          <button type="button" onClick={backUp} disabled={visits.length === 0 && !crawl}>
            💾 Back up visits
          </button>
          <button type="button" onClick={chooseFile}>
            📂 Restore from backup
          </button>
          <p className="app-menu-note">
            Visits are only saved on this device. Last backup:{' '}
            <strong>{backup.lastBackup ? formatDate(backup.lastBackup) : 'never'}</strong>
          </p>
          <p className="app-menu-note app-menu-credit">
            Pub photos © J D Wetherspoon plc. Spoons Collector is an unofficial fan app, not made by or
            connected with Wetherspoon.
          </p>
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="backup-file-input"
        aria-label="Backup file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset so choosing the same file again still triggers a change
          event.target.value = '';
          if (file) void restore.readFile(file);
        }}
      />

      {status && (
        <div className={`app-menu-status app-menu-status--${status.kind}`} role="status">
          <span>{status.text}</span>
          <button type="button" onClick={clearStatus} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {restore.pendingRestore && (
        <RestoreConfirmDialog
          restore={restore.pendingRestore}
          currentCount={visits.length}
          onConfirm={restore.confirmRestore}
          onCancel={restore.cancelRestore}
        />
      )}
    </div>
  );
};
