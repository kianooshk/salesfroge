'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Banner, Modal } from '@/components/ui';
import { useApp } from '@/components/Shell';

function monthMatrix(cursor: Date) {
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = new Date(start);
  gridStart.setDate(1 - start.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

export default function CalendarPage() {
  const { me } = useApp();
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ subject: '', startTime: '', endTime: '', location: '' });

  const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1).toISOString();
  const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1).toISOString();

  function load() {
    api(`/calendar/events?from=${from}&to=${to}`).then(setEvents).catch((err) => setError(err.message));
    api('/calendar/status').then(setStatus).catch(() => undefined);
  }
  useEffect(() => { load(); }, [from, to]);

  const days = useMemo(() => monthMatrix(cursor), [cursor]);
  const byDay = (day: Date) => events.filter((event) => {
    const when = new Date(event.startTime || event.dueDate);
    return when.getFullYear() === day.getFullYear() && when.getMonth() === day.getMonth() && when.getDate() === day.getDate();
  });

  async function connect(provider: 'google' | 'outlook') {
    setError(null);
    try {
      const result = await api(`/calendar/${provider}/connect?json=1`);
      window.location.href = result.url;
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function sync() {
    setError(null);
    try {
      const result = await api('/calendar/sync', { method: 'POST', body: { provider: 'all' } });
      setError(`Synced ${result.results?.reduce((sum: number, item: any) => sum + item.synced, 0) || 0} meetings.`);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function createMeeting() {
    await api('/activities', { method: 'POST', body: { type: 'Meeting', status: 'Open', ownerId: me.id, ...form } });
    setCreating(false);
    load();
  }

  return (
    <div>
      <Banner error={error} />
      <div className="slds-page-header">
        <div className="slds-page-header__row">
          <div className="slds-page-header__col-title">
            <h1 className="slds-page-header__title">{cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</h1>
          </div>
          <div className="slds-page-header__col-actions slds-button-group">
            <button className="slds-button slds-button_neutral" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>Prev</button>
            <button className="slds-button slds-button_neutral" onClick={() => setCursor(new Date())}>Today</button>
            <button className="slds-button slds-button_neutral" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>Next</button>
            <button className="slds-button slds-button_brand" onClick={() => setCreating(true)}>New meeting</button>
          </div>
        </div>
      </div>
      <div className="slds-grid slds-wrap slds-m-top_medium">
        <div className="slds-col slds-size_1-of-1 slds-large-size_3-of-4">
          <div className="sf-cal">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => <div key={label} className="sf-cal-head">{label}</div>)}
            {days.map((day) => (
              <div key={day.toISOString()} className={`sf-cal-day ${day.getMonth() === cursor.getMonth() ? '' : 'is-out'}`}>
                <div className="sf-muted">{day.getDate()}</div>
                {byDay(day).map((event) => (
                  <Link key={event.id} href={`/o/activities/${event.id}`} className={`sf-pill ${event.type === 'Task' ? 'task' : ''}`}>{event.subject}</Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        <aside className="slds-col slds-size_1-of-1 slds-large-size_1-of-4 slds-p-left_small">
          <article className="slds-card">
            <div className="slds-card__header"><h2 className="slds-card__header-title">Calendar sync</h2></div>
            <div className="slds-card__body slds-card__body_inner">
              <p className="sf-muted">OAuth uses GOOGLE_* and OUTLOOK_* environment variables. Meetings you own are pushed when you sync.</p>
              <p className="slds-m-top_small">Google: {status?.googleConnected ? 'Connected' : status?.googleConfigured ? 'Not connected' : 'Not configured'}</p>
              <button className="slds-button slds-button_neutral slds-m-bottom_x-small" onClick={() => connect('google')}>Connect Google</button>
              <p>Outlook: {status?.outlookConnected ? 'Connected' : status?.outlookConfigured ? 'Not connected' : 'Not configured'}</p>
              <button className="slds-button slds-button_neutral slds-m-bottom_small" onClick={() => connect('outlook')}>Connect Outlook</button>
              <button className="slds-button slds-button_brand" onClick={sync}>Sync meetings</button>
            </div>
          </article>
        </aside>
      </div>
      {creating && (
        <Modal title="New meeting" onClose={() => setCreating(false)} footer={<><button className="slds-button slds-button_neutral" onClick={() => setCreating(false)}>Cancel</button><button className="slds-button slds-button_brand" onClick={createMeeting}>Save</button></>}>
          <input className="slds-input slds-m-bottom_x-small" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <input className="slds-input slds-m-bottom_x-small" type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
          <input className="slds-input slds-m-bottom_x-small" type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          <input className="slds-input" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </Modal>
      )}
    </div>
  );
}
