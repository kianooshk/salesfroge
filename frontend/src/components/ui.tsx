'use client';

import { useEffect, useState } from 'react';
import { compactNumber, person } from '@/lib/format';

export function Banner({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <div className="slds-notify slds-notify_alert slds-alert_error slds-m-bottom_small" role="alert">
      <h2>{error}</h2>
    </div>
  );
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <section role="dialog" aria-modal="true" aria-label={title} className="slds-modal slds-fade-in-open">
        <div className="slds-modal__container">
          <header className="slds-modal__header">
            <button className="slds-button slds-button_icon slds-modal__close" title="Close" onClick={onClose}>
              <span className="slds-assistive-text">Close</span>×
            </button>
            <h2 className="slds-modal__title slds-hyphenate">{title}</h2>
          </header>
          <div className="slds-modal__content slds-p-around_medium">{children}</div>
          {footer && <footer className="slds-modal__footer">{footer}</footer>}
        </div>
      </section>
      <div className="slds-backdrop slds-backdrop_open" onClick={onClose} />
    </>
  );
}

export function RichText({ body }: { body?: string }) {
  const parts = (body || '').split(/(@\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^@\[([^\]]+)\]\([^)]+\)$/);
        if (match) return <span key={index} className="sf-mention">@{match[1]}</span>;
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

export function MentionComposer({
  placeholder,
  onSubmit,
  users,
  button = 'Share',
}: {
  placeholder: string;
  onSubmit: (body: string) => Promise<void> | void;
  users: any[];
  button?: string;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const match = text.match(/@([A-Za-z]*)$/);
  const suggestions = match
    ? users.filter((user) => person(user).toLowerCase().includes((match[1] || '').toLowerCase())).slice(0, 6)
    : [];

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onSubmit(text.trim());
      setText('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <textarea className="slds-textarea" rows={3} placeholder={placeholder} value={text} onChange={(event) => setText(event.target.value)} />
      {suggestions.length > 0 && (
        <ul className="slds-list_vertical slds-m-top_xx-small slds-box slds-box_x-small">
          {suggestions.map((user) => (
            <li key={user.id}>
              <button
                className="slds-button slds-button_reset"
                type="button"
                onClick={() => setText(text.replace(/@([A-Za-z]*)$/, `@[${person(user)}](${user.id}) `))}
              >
                {person(user)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="slds-m-top_x-small">
        <button className="slds-button slds-button_brand" type="button" disabled={busy} onClick={submit}>{button}</button>
      </div>
    </div>
  );
}

export function Fields({
  fields,
  value,
  onChange,
  users,
  accounts,
  contacts,
  stages,
}: {
  fields: any[];
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
  users: any[];
  accounts?: any[];
  contacts?: any[];
  stages?: { name: string; probability: number }[];
}) {
  function set(name: string, next: any) {
    if (name === 'stage' && stages) {
      const stage = stages.find((item) => item.name === next);
      onChange({ ...value, stage: next, probability: stage ? stage.probability : value.probability });
      return;
    }
    onChange({ ...value, [name]: next });
  }

  return (
    <div className="slds-grid slds-wrap">
      {fields.map((field) => (
        <div key={field.name} className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-p-horizontal_x-small slds-m-bottom_small">
          <div className="slds-form-element">
            <label className="slds-form-element__label" htmlFor={`f-${field.name}`}>
              {field.required && <abbr className="slds-required" title="required">*</abbr>} {field.label}
            </label>
            <div className="slds-form-element__control">
              {field.type === 'textarea' ? (
                <textarea id={`f-${field.name}`} className="slds-textarea" rows={3} value={value[field.name] ?? ''} onChange={(e) => set(field.name, e.target.value)} />
              ) : field.type === 'picklist' || field.lookup ? (
                <select id={`f-${field.name}`} className="slds-select" value={value[field.name] ?? ''} onChange={(e) => set(field.name, e.target.value)}>
                  <option value="">—</option>
                  {field.lookup === 'user' && users.map((user) => <option key={user.id} value={user.id}>{person(user)}</option>)}
                  {field.lookup === 'account' && (accounts || []).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  {field.lookup === 'contact' && (contacts || []).map((contact) => <option key={contact.id} value={contact.id}>{person(contact)}</option>)}
                  {field.type === 'picklist' && (field.options || []).map((option: string) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input
                  id={`f-${field.name}`}
                  className="slds-input"
                  type={field.type === 'number' || field.type === 'currency' ? 'number' : field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                  value={value[field.name] ?? ''}
                  onChange={(e) => set(field.name, e.target.value)}
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Chart({ groups, type = 'bar' }: { groups: { key: string; value: number; count?: number }[]; type?: string }) {
  if (!groups?.length) return <p className="sf-muted">No data for this chart yet.</p>;
  if (type === 'table') {
    return (
      <table className="slds-table slds-table_cell-buffer slds-table_bordered">
        <thead><tr><th>Group</th><th>Value</th></tr></thead>
        <tbody>{groups.map((group) => <tr key={group.key}><td>{group.key}</td><td>{compactNumber(group.value)}</td></tr>)}</tbody>
      </table>
    );
  }
  if (type === 'funnel') {
    const max = Math.max(...groups.map((group) => group.value), 1);
    return (
      <div>
        {groups.map((group) => (
          <div key={group.key} className="sf-funnel-row">
            <span className="sf-funnel-label">{group.key}</span>
            <div className="sf-funnel-track">
              <div className="sf-funnel-bar" style={{ width: `${Math.max(6, (group.value / max) * 100)}%` }}>{compactNumber(group.value)}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (type === 'pie') {
    const total = groups.reduce((sum, group) => sum + group.value, 0) || 1;
    let angle = 0;
    const colors = ['#0176d3', '#2e844a', '#e07c00', '#9050e9', '#ba0517', '#0b827c', '#1b96ff'];
    const slices = groups.map((group, index) => {
      const start = angle;
      angle += (group.value / total) * Math.PI * 2;
      const large = angle - start > Math.PI ? 1 : 0;
      const r = 70;
      const x1 = 90 + r * Math.sin(start);
      const y1 = 90 - r * Math.cos(start);
      const x2 = 90 + r * Math.sin(angle);
      const y2 = 90 - r * Math.cos(angle);
      const d = `M 90 90 L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      return <path key={group.key} d={d} fill={colors[index % colors.length]}><title>{group.key}: {group.value}</title></path>;
    });
    return (
      <div className="slds-grid slds-grid_vertical-align-center">
        <svg viewBox="0 0 180 180" className="sf-chart" style={{ maxWidth: 180 }}>{slices}</svg>
        <ul className="slds-list_dotted slds-m-left_small">
          {groups.map((group, index) => <li key={group.key}><span style={{ color: colors[index % colors.length] }}>●</span> {group.key} ({compactNumber(group.value)})</li>)}
        </ul>
      </div>
    );
  }
  const max = Math.max(...groups.map((group) => group.value), 1);
  const width = Math.max(320, groups.length * 56);
  const height = 160;
  return (
    <svg viewBox={`0 0 ${width} 210`} className="sf-chart" role="img">
      {groups.map((group, index) => {
        const bar = Math.min(36, width / groups.length - 16);
        const h = (group.value / max) * height;
        const x = 12 + index * (width / groups.length);
        return (
          <g key={group.key}>
            <rect x={x} y={height - h + 10} width={bar} height={Math.max(h, 1)} rx="2" fill={type === 'line' ? '#2e844a' : '#0176d3'} />
            <text x={x + bar / 2} y={height - h + 4} textAnchor="middle" fontSize="10">{compactNumber(group.value)}</text>
            <text x={x + bar / 2} y={height + 28} textAnchor="middle" fontSize="10" fill="#444">{String(group.key).slice(0, 11)}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Avatar({ user }: { user?: { firstName?: string; lastName?: string; avatarColor?: string } | null }) {
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || '?';
  return <span className="sf-avatar" style={{ background: user?.avatarColor || '#1b5f8c' }}>{initials}</span>;
}
