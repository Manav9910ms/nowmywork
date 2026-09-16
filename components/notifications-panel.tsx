'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import styles from '@/app/dashboard/dashboard.module.css';

type Notification = { id: string; type: string; title: string; body: string; jobId?: string; read?: boolean; createdAt?: { _seconds?: number; seconds?: number } };

function timeLabel(value: Notification['createdAt']) {
  const seconds = value?._seconds ?? value?.seconds;
  return seconds ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(seconds * 1000)) : 'now';
}

export default function NotificationsPanel() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/notifications', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json() as { notifications?: Notification[] };
      setItems(data.notifications ?? []);
    } catch { /* dashboard remains usable when notifications are temporarily unavailable */ }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(interval);
  }, []);

  const unread = items.filter((item) => !item.read).length;

  async function markAllRead() {
    const user = auth.currentUser;
    if (!user || unread === 0) return;
    const token = await user.getIdToken();
    await fetch('/api/notifications', { method: 'PATCH', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ all: true }) });
    setItems((current) => current.map((item) => ({ ...item, read: true })));
  }

  return <div className={styles.notificationsWrap}>
    <button type="button" className={styles.notificationButton} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
      <span>Notifications</span>{unread > 0 && <b>{unread > 9 ? '9+' : unread}</b>}
    </button>
    {open && <div className={styles.notificationPanel}>
      <div className={styles.notificationHeader}><strong>Notifications</strong><button type="button" onClick={() => void markAllRead()} disabled={unread === 0}>Mark all read</button></div>
      {items.length === 0 ? <div className={styles.notificationEmpty}>Nothing new right now.</div> : <div className={styles.notificationList}>{items.map((item) => <article key={item.id} className={item.read ? styles.notification : `${styles.notification} ${styles.notificationUnread}`}><strong>{item.title}</strong><p>{item.body}</p><time>{timeLabel(item.createdAt)}</time></article>)}</div>}
    </div>}
  </div>;
}
