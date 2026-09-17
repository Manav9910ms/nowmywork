'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { auth } from '@/lib/firebase';
import styles from '@/app/project/[jobId]/project.module.css';

type Message = {
  id: string;
  senderId: string;
  senderRole: string;
  text: string;
  createdAt?: {
    _seconds?: number;
    seconds?: number;
    _nanoseconds?: number;
    nanoseconds?: number;
  };
};

function messageTime(value: Message['createdAt']) {
  const seconds = value?._seconds ?? value?.seconds;
  return seconds
    ? new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(seconds * 1000))
    : 'now';
}

export default function ProjectMessages({ jobId }: { jobId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const token = await user.getIdToken();
      const response = await fetch(`/api/messages?jobId=${encodeURIComponent(jobId)}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = (await response.json()) as { messages?: Message[]; error?: string };

      if (!response.ok) throw new Error(data.error ?? 'Could not load messages.');
      setMessages(data.messages ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(interval);
  }, [jobId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value || sending) return;

    setSending(true);
    setError('');

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Sign in is required.');

      const token = await user.getIdToken();
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ jobId, text: value }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) throw new Error(data.error ?? 'Could not send message.');
      setText('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className={styles.messagesCard}>
      <div className="eyebrow muted">PROJECT MESSAGES</div>
      <h2>Work together.</h2>
      <p className={styles.messageIntro}>Project-specific communication stays inside NowMyWork.</p>

      {error && <div className={styles.error} role="alert">{error}</div>}

      <div className={styles.messageList} aria-live="polite">
        {loading ? (
          <div className={styles.messageEmpty}>Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className={styles.messageEmpty}>
            <strong>No messages yet.</strong>
            <span>Start the conversation with a clear first update.</span>
          </div>
        ) : (
          messages.map((message) => {
            const isMine = message.senderId === auth.currentUser?.uid;
            return (
              <article
                key={message.id}
                className={isMine ? `${styles.message} ${styles.mine}` : styles.message}
              >
                <div>
                  <span>{message.senderRole}</span>
                  <time>{messageTime(message.createdAt)}</time>
                </div>
                <p>{message.text}</p>
              </article>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form className={styles.messageForm} onSubmit={send}>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Write a project update…"
          rows={3}
          maxLength={5000}
        />
        <button type="submit" className="primary-btn" disabled={sending || !text.trim()}>
          {sending ? 'Sending…' : 'Send message →'}
        </button>
      </form>
    </section>
  );
}
