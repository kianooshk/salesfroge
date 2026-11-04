'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, apiBlob } from '@/lib/api';
import { cell, dateTimeFmt, formFromRecord, person, splitPayload, titleOf } from '@/lib/format';
import { useApp } from './Shell';
import { Icon, IconBox } from './Icon';
import { Avatar, Banner, Fields, MentionComposer, Modal, RichText } from './ui';

const TABS = ['Details', 'Activity', 'Feed', 'Email', 'Files'] as const;

export default function RecordScreen({ objectKey, id }: { objectKey: string; id: string }) {
  const { objects, users, teams, me, refreshNotifications } = useApp();
  const meta = objects.find((object) => object.key === objectKey);
  const router = useRouter();
  const [record, setRecord] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Details');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [accounts, setAccounts] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [shares, setShares] = useState<any[]>([]);
  const [sharing, setSharing] = useState(false);
  const [shareForm, setShareForm] = useState({ userId: '', teamId: '', access: 'read' });
  const [converting, setConverting] = useState(false);
  const [convertForm, setConvertForm] = useState({ createOpportunity: true, opportunityName: '', amount: '', closeDate: '' });
  const [activityForm, setActivityForm] = useState({ type: 'Task', subject: '', description: '', dueDate: '', startTime: '', endTime: '' });
  const [mail, setMail] = useState({ to: '', subject: '', body: '', templateId: '' });
  const [preview, setPreview] = useState<{ name: string; url: string; type: string } | null>(null);

  const relatedType = meta?.objectType;

  async function load() {
    if (!meta) return;
    const data = await api(`${meta.endpoint}/${id}`);
    setRecord(data);
    setForm(formFromRecord(meta, data));
    const [acts, posts, msgs, tpls, docs, shareRows] = await Promise.all([
      api(`/activities?relatedType=${encodeURIComponent(relatedType)}&relatedId=${id}`).catch(() => []),
      api(`/feed?relatedType=${encodeURIComponent(relatedType)}&relatedId=${id}`).catch(() => []),
      api(`/email?relatedType=${encodeURIComponent(relatedType)}&relatedId=${id}`).catch(() => []),
      api('/email/templates').catch(() => []),
      api(`/files?relatedType=${encodeURIComponent(relatedType)}&relatedId=${id}`).catch(() => []),
      meta.custom ? Promise.resolve([]) : api(`/shares?recordType=${encodeURIComponent(relatedType)}&recordId=${id}`).catch(() => []),
    ]);
    setActivities(acts);
    setFeed(posts);
    setEmails(msgs);
    setTemplates(tpls);
    setFiles(docs);
    setShares(shareRows);
    if (!mail.to && data.email) setMail((current) => ({ ...current, to: data.email }));
  }

  useEffect(() => {
    if (!meta) return;
    load().catch((err) => setError(err.message));
    if (meta.fields.some((field: any) => field.lookup === 'account')) api('/accounts').then(setAccounts).catch(() => undefined);
    if (meta.fields.some((field: any) => field.lookup === 'contact')) api('/contacts').then(setContacts).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.key, id]);

  if (!meta) return <p>That object is not available.</p>;
  if (!record) return <div className="slds-p-around_medium">{error || 'Loading record…'}</div>;

  const currentPath = meta.pathField ? record[meta.pathField] : null;
  const pathIndex = meta.path ? meta.path.indexOf(currentPath) : -1;

  async function save() {
    setError(null);
    try {
      const updated = await api(`${meta.endpoint}/${id}`, { method: 'PATCH', body: splitPayload(meta, form) });
      setRecord(updated);
      setEditing(false);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function setPath(value: string) {
    const updated = await api(`${meta.endpoint}/${id}`, { method: 'PATCH', body: { [meta.pathField]: value } });
    setRecord({ ...record, ...updated });
    setForm(formFromRecord(meta, { ...record, ...updated }));
  }

  async function remove() {
    if (!confirm(`Delete this ${meta.label.toLowerCase()}?`)) return;
    await api(`${meta.endpoint}/${id}`, { method: 'DELETE' });
    router.push(`/o/${meta.key}`);
  }

  async function convert() {
    const result = await api(`/leads/${id}/convert`, { method: 'POST', body: { ...convertForm, amount: convertForm.amount ? Number(convertForm.amount) : undefined } });
    router.push(`/o/accounts/${result.accountId}`);
  }

  async function addActivity() {
    await api('/activities', {
      method: 'POST',
      body: { ...activityForm, relatedType, relatedId: id, ownerId: me.id },
    });
    setActivityForm({ type: 'Task', subject: '', description: '', dueDate: '', startTime: '', endTime: '' });
    setActivities(await api(`/activities?relatedType=${encodeURIComponent(relatedType)}&relatedId=${id}`));
  }

  async function addShare() {
    await api('/shares', { method: 'POST', body: { recordType: relatedType, recordId: id, access: shareForm.access, userId: shareForm.userId || undefined, teamId: shareForm.teamId || undefined } });
    setShares(await api(`/shares?recordType=${encodeURIComponent(relatedType)}&recordId=${id}`));
    setShareForm({ userId: '', teamId: '', access: 'read' });
  }

  async function sendEmail() {
    const result = await api('/email/send', { method: 'POST', body: { ...mail, relatedType, relatedId: id } });
    setEmails(await api(`/email?relatedType=${encodeURIComponent(relatedType)}&relatedId=${id}`));
    if (result.warning) setError(result.warning);
    else setError(null);
  }

  async function upload(file: File) {
    const body = new FormData();
    body.append('file', file);
    await api(`/files?relatedType=${encodeURIComponent(relatedType)}&relatedId=${id}`, { method: 'POST', body });
    setFiles(await api(`/files?relatedType=${encodeURIComponent(relatedType)}&relatedId=${id}`));
  }

  async function openPreview(file: any) {
    const loaded = await apiBlob(`/files/${file.id}/content`);
    setPreview({ name: file.originalName, url: URL.createObjectURL(loaded.blob), type: loaded.type });
  }

  return (
    <div>
      <Banner error={error} />
      <div className="slds-page-header slds-page-header_record-home">
        <div className="slds-page-header__row">
          <div className="slds-page-header__col-title">
            <div className="slds-media">
              <div className="slds-media__figure"><IconBox name={meta.icon || 'custom'} /></div>
              <div className="slds-media__body">
                <p className="slds-page-header__name-meta">{meta.label}</p>
                <h1 className="slds-page-header__title">{titleOf(record)}</h1>
              </div>
            </div>
          </div>
          <div className="slds-page-header__col-actions">
            <div className="slds-button-group" role="group">
              {meta.supportsConvert && !record.isConverted && <button className="slds-button slds-button_brand" onClick={() => { setConvertForm({ ...convertForm, opportunityName: `${record.company} opportunity` }); setConverting(true); }}>Convert</button>}
              {!meta.custom && <button className="slds-button slds-button_neutral" onClick={() => setSharing(true)}>Sharing</button>}
              <button className="slds-button slds-button_neutral" onClick={() => setEditing(true)}>Edit</button>
              <button className="slds-button slds-button_destructive" onClick={remove}>Delete</button>
            </div>
          </div>
        </div>
        <div className="sf-highlights">
          {meta.highlights.map((name: string) => {
            const field = meta.fields.find((item: any) => item.name === name || (name === 'owner' && item.name === 'ownerId') || (name === 'account' && item.name === 'accountId'));
            return (
              <div key={name}>
                <span>{field?.label || name}</span>
                <strong>{name === 'account' && record.account ? <Link href={`/o/accounts/${record.account.id}`}>{record.account.name}</Link> : cell(record, name)}</strong>
              </div>
            );
          })}
        </div>
      </div>

      {record.isConverted && (
        <div className="slds-notify slds-notify_alert slds-alert_warning slds-m-top_small" role="status">
          <h2>
            Converted.{' '}
            {record.convertedAccountId && <Link href={`/o/accounts/${record.convertedAccountId}`}>Account</Link>}{' '}
            {record.convertedContactId && <Link href={`/o/contacts/${record.convertedContactId}`}>Contact</Link>}{' '}
            {record.convertedOpportunityId && <Link href={`/o/opportunities/${record.convertedOpportunityId}`}>Opportunity</Link>}
          </h2>
        </div>
      )}

      {meta.path && (
        <div className="slds-path slds-m-top_small">
          <div className="slds-grid slds-path__track">
            <div className="slds-grid slds-path__scroller-container">
              <ul className="slds-path__nav" role="list">
                {meta.path.map((step: string, index: number) => {
                  const state = index < pathIndex ? 'slds-is-complete' : index === pathIndex ? 'slds-is-current slds-is-active' : 'slds-is-incomplete';
                  return (
                    <li key={step} className={`slds-path__item ${state}`}>
                      <button className="slds-path__link sf-path-btn" type="button" onClick={() => setPath(step)}>
                        <span className="slds-path__stage">
                          <Icon name={index <= pathIndex ? 'check' : 'check'} sprite="utility" size="x-small" />
                        </span>
                        <span className="slds-path__title">{step}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="slds-tabs_default slds-m-top_medium">
        <ul className="slds-tabs_default__nav" role="tablist">
          {TABS.map((name) => (
            <li key={name} className={`slds-tabs_default__item ${tab === name ? 'slds-is-active' : ''}`} role="presentation">
              <button className="slds-tabs_default__link sf-path-btn" role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>{name}</button>
            </li>
          ))}
        </ul>
        <div className="slds-tabs_default__content slds-show">
          {tab === 'Details' && (
            <div className="slds-grid slds-wrap slds-m-top_medium">
              <div className="slds-col slds-size_1-of-1 slds-large-size_2-of-3">
                <article className="slds-card">
                  <div className="slds-card__header slds-grid"><h2 className="slds-card__header-title">Details</h2></div>
                  <div className="slds-card__body slds-card__body_inner">
                    <dl className="slds-list_horizontal slds-wrap">
                      {meta.fields.map((field: any) => (
                        <div key={field.name} className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-m-bottom_small">
                          <dt className="sf-muted">{field.label}</dt>
                          <dd>{field.lookup === 'user' ? person(users.find((user) => user.id === record[field.name])) || cell(record, 'owner') : field.lookup === 'account' ? record.account?.name || '—' : field.lookup === 'contact' ? person(record.contact) || '—' : cell({ ...record, ...(record.customFields || {}), ...(record.values || {}) }, field.name)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </article>
                {(meta.relatedLists || []).map((list: any) => (
                  <article key={list.key} className="slds-card slds-m-top_small">
                    <div className="slds-card__header"><h2 className="slds-card__header-title">{list.label} ({record[list.key]?.length || 0})</h2></div>
                    <ul className="slds-has-dividers_bottom-space slds-p-horizontal_small">
                      {(record[list.key] || []).map((item: any) => (
                        <li key={item.id} className="slds-item"><Link href={`/o/${list.object}/${item.id}`}>{titleOf(item)}</Link> <span className="sf-muted">{item.stage || item.status || item.title || item.email || ''}</span></li>
                      ))}
                      {(record[list.key] || []).length === 0 && <li className="slds-item sf-muted">None yet.</li>}
                    </ul>
                  </article>
                ))}
              </div>
              <div className="slds-col slds-size_1-of-1 slds-large-size_1-of-3 slds-p-left_small">
                <article className="slds-card">
                  <div className="slds-card__header"><h2 className="slds-card__header-title">Owner</h2></div>
                  <div className="slds-card__body slds-card__body_inner slds-media">
                    <div className="slds-media__figure"><Avatar user={record.owner} /></div>
                    <div className="slds-media__body">{person(record.owner) || 'Unassigned'}</div>
                  </div>
                </article>
              </div>
            </div>
          )}

          {tab === 'Activity' && (
            <div className="slds-grid slds-wrap slds-m-top_medium">
              <div className="slds-col slds-size_1-of-1 slds-large-size_1-of-3">
                <article className="slds-card">
                  <div className="slds-card__header"><h2 className="slds-card__header-title">Log activity</h2></div>
                  <div className="slds-card__body slds-card__body_inner">
                    <select className="slds-select slds-m-bottom_x-small" value={activityForm.type} onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value })}>
                      {['Task', 'Call', 'Meeting', 'Note'].map((type) => <option key={type}>{type}</option>)}
                    </select>
                    <input className="slds-input slds-m-bottom_x-small" placeholder="Subject" value={activityForm.subject} onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })} />
                    <textarea className="slds-textarea slds-m-bottom_x-small" rows={3} placeholder="Description" value={activityForm.description} onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })} />
                    {(activityForm.type === 'Task') && <input className="slds-input slds-m-bottom_x-small" type="date" value={activityForm.dueDate} onChange={(e) => setActivityForm({ ...activityForm, dueDate: e.target.value })} />}
                    {activityForm.type === 'Meeting' && (
                      <>
                        <input className="slds-input slds-m-bottom_x-small" type="datetime-local" value={activityForm.startTime} onChange={(e) => setActivityForm({ ...activityForm, startTime: e.target.value })} />
                        <input className="slds-input slds-m-bottom_x-small" type="datetime-local" value={activityForm.endTime} onChange={(e) => setActivityForm({ ...activityForm, endTime: e.target.value })} />
                      </>
                    )}
                    <button className="slds-button slds-button_brand" disabled={!activityForm.subject} onClick={addActivity}>Save</button>
                  </div>
                </article>
              </div>
              <div className="slds-col slds-size_1-of-1 slds-large-size_2-of-3">
                <ul className="slds-timeline">
                  {activities.map((activity) => (
                    <li key={activity.id}>
                      <div className={`slds-timeline__item_expandable slds-timeline__item_${activity.type === 'Call' ? 'call' : activity.type === 'Meeting' ? 'event' : activity.type === 'Note' ? 'note' : 'task'}`}>
                        <div className="slds-media">
                          <div className="slds-media__figure"><IconBox name={activity.type === 'Call' ? 'call' : activity.type === 'Meeting' ? 'event' : activity.type === 'Note' ? 'note' : 'task'} size="small" /></div>
                          <div className="slds-media__body">
                            <div className="slds-grid slds-grid_align-spread">
                              <h3 className="slds-truncate"><Link href={`/o/activities/${activity.id}`}>{activity.subject}</Link></h3>
                              <span className="sf-muted">{activity.type} · {dateTimeFmt(activity.startTime || activity.dueDate || activity.createdAt)}</span>
                            </div>
                            <p>{activity.description}</p>
                            {activity.type === 'Task' && activity.status !== 'Completed' && (
                              <button className="slds-button slds-button_neutral" onClick={async () => { await api(`/activities/${activity.id}`, { method: 'PATCH', body: { status: 'Completed' } }); setActivities(await api(`/activities?relatedType=${encodeURIComponent(relatedType)}&relatedId=${id}`)); }}>Mark complete</button>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                  {activities.length === 0 && <li className="sf-muted">No activity yet.</li>}
                </ul>
              </div>
            </div>
          )}

          {tab === 'Feed' && (
            <div className="slds-m-top_medium" style={{ maxWidth: 720 }}>
              <MentionComposer users={users} placeholder="Share an update. Use @ to mention a teammate." button="Post" onSubmit={async (body) => { await api('/feed', { method: 'POST', body: { body, relatedType, relatedId: id } }); setFeed(await api(`/feed?relatedType=${encodeURIComponent(relatedType)}&relatedId=${id}`)); refreshNotifications(); }} />
              <div className="slds-m-top_medium">
                {feed.map((item) => (
                  <article key={item.id} className="slds-post slds-m-bottom_medium">
                    <header className="slds-post__header slds-media">
                      <div className="slds-media__figure"><Avatar user={item.author} /></div>
                      <div className="slds-media__body"><h3>{person(item.author)}</h3><p className="sf-muted">{dateTimeFmt(item.createdAt)}</p></div>
                    </header>
                    <div className="slds-post__content"><RichText body={item.body} /></div>
                    <ul className="slds-m-top_small">
                      {(item.comments || []).map((comment: any) => (
                        <li key={comment.id} className="slds-m-bottom_x-small"><strong>{person(comment.author)}</strong> <RichText body={comment.body} /></li>
                      ))}
                    </ul>
                    <MentionComposer users={users} placeholder="Write a comment" button="Comment" onSubmit={async (body) => { await api(`/feed/${item.id}/comments`, { method: 'POST', body: { body } }); setFeed(await api(`/feed?relatedType=${encodeURIComponent(relatedType)}&relatedId=${id}`)); }} />
                  </article>
                ))}
              </div>
            </div>
          )}

          {tab === 'Email' && (
            <div className="slds-grid slds-wrap slds-m-top_medium">
              <div className="slds-col slds-size_1-of-1 slds-large-size_1-of-2">
                <article className="slds-card">
                  <div className="slds-card__header"><h2 className="slds-card__header-title">Send email</h2></div>
                  <div className="slds-card__body slds-card__body_inner">
                    <p className="sf-muted slds-m-bottom_small">Merge fields such as {'{{name}}'} and {'{{accountName}}'} are filled from this record. Without SMTP the message is logged, not delivered.</p>
                    <select className="slds-select slds-m-bottom_x-small" value={mail.templateId} onChange={(e) => {
                      const template = templates.find((item) => item.id === e.target.value);
                      setMail({ ...mail, templateId: e.target.value, subject: template?.subject || mail.subject, body: template?.body || mail.body });
                    }}>
                      <option value="">No template</option>
                      {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                    </select>
                    <input className="slds-input slds-m-bottom_x-small" placeholder="To" value={mail.to} onChange={(e) => setMail({ ...mail, to: e.target.value })} />
                    <input className="slds-input slds-m-bottom_x-small" placeholder="Subject" value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} />
                    <textarea className="slds-textarea slds-m-bottom_x-small" rows={6} value={mail.body} onChange={(e) => setMail({ ...mail, body: e.target.value })} />
                    <button className="slds-button slds-button_brand" onClick={sendEmail}>Send / log</button>
                  </div>
                </article>
              </div>
              <div className="slds-col slds-size_1-of-1 slds-large-size_1-of-2">
                {emails.map((message) => (
                  <article key={message.id} className="slds-card slds-m-bottom_small">
                    <div className="slds-card__header"><h2 className="slds-card__header-title">{message.subject}</h2></div>
                    <div className="slds-card__body slds-card__body_inner">
                      <p className="sf-muted">{message.direction} · {message.status} · {message.toAddresses}</p>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{message.body}</p>
                    </div>
                  </article>
                ))}
                {emails.length === 0 && <p className="sf-muted">No email logged on this record.</p>}
              </div>
            </div>
          )}

          {tab === 'Files' && (
            <div className="slds-m-top_medium">
              <label className="slds-button slds-button_neutral">
                Upload
                <input type="file" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); }} />
              </label>
              <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-m-top_small">
                <thead><tr><th>Name</th><th>Type</th><th>Size</th><th></th></tr></thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id}>
                      <td>{file.originalName}</td>
                      <td>{file.mimeType}</td>
                      <td>{Math.ceil(file.size / 1024)} KB</td>
                      <td>
                        <button className="slds-button slds-button_neutral" onClick={() => openPreview(file)}>Preview</button>
                        <button className="slds-button slds-button_text-destructive" onClick={async () => { await api(`/files/${file.id}`, { method: 'DELETE' }); setFiles(await api(`/files?relatedType=${encodeURIComponent(relatedType)}&relatedId=${id}`)); }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {files.length === 0 && <tr><td colSpan={4}>No files yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <Modal title={`Edit ${meta.label}`} onClose={() => setEditing(false)} footer={<><button className="slds-button slds-button_neutral" onClick={() => setEditing(false)}>Cancel</button><button className="slds-button slds-button_brand" onClick={save}>Save</button></>}>
          <Fields fields={meta.fields} value={form} onChange={setForm} users={users} accounts={accounts} contacts={contacts} stages={meta.stages} />
        </Modal>
      )}
      {converting && (
        <Modal title="Convert lead" onClose={() => setConverting(false)} footer={<><button className="slds-button slds-button_neutral" onClick={() => setConverting(false)}>Cancel</button><button className="slds-button slds-button_brand" onClick={convert}>Convert</button></>}>
          <p className="slds-m-bottom_small">Creates an account and contact from this lead.</p>
          <label className="slds-checkbox"><input type="checkbox" checked={convertForm.createOpportunity} onChange={(e) => setConvertForm({ ...convertForm, createOpportunity: e.target.checked })} /> <span className="slds-form-element__label">Also create an opportunity</span></label>
          {convertForm.createOpportunity && (
            <div className="slds-m-top_small">
              <input className="slds-input slds-m-bottom_x-small" placeholder="Opportunity name" value={convertForm.opportunityName} onChange={(e) => setConvertForm({ ...convertForm, opportunityName: e.target.value })} />
              <input className="slds-input slds-m-bottom_x-small" type="number" placeholder="Amount" value={convertForm.amount} onChange={(e) => setConvertForm({ ...convertForm, amount: e.target.value })} />
              <input className="slds-input" type="date" value={convertForm.closeDate} onChange={(e) => setConvertForm({ ...convertForm, closeDate: e.target.value })} />
            </div>
          )}
        </Modal>
      )}
      {sharing && (
        <Modal title="Record sharing" onClose={() => setSharing(false)}>
          <p className="sf-muted slds-m-bottom_small">Owners and people above them in the role hierarchy already have access. Add a person or a team.</p>
          <ul className="slds-m-bottom_small">
            {shares.map((share) => (
              <li key={share.id} className="slds-grid slds-grid_align-spread">
                <span>{share.user ? person(share.user) : share.team?.name} · {share.access}</span>
                <button className="slds-button slds-button_reset" onClick={async () => { await api(`/shares/${share.id}`, { method: 'DELETE' }); setShares(await api(`/shares?recordType=${encodeURIComponent(relatedType)}&recordId=${id}`)); }}>Remove</button>
              </li>
            ))}
            {shares.length === 0 && <li className="sf-muted">No extra shares.</li>}
          </ul>
          <div className="slds-grid slds-gutters_x-small">
            <select className="slds-select" value={shareForm.userId} onChange={(e) => setShareForm({ ...shareForm, userId: e.target.value, teamId: '' })}>
              <option value="">User</option>
              {users.map((user) => <option key={user.id} value={user.id}>{person(user)}</option>)}
            </select>
            <select className="slds-select" value={shareForm.teamId} onChange={(e) => setShareForm({ ...shareForm, teamId: e.target.value, userId: '' })}>
              <option value="">Team</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <select className="slds-select" value={shareForm.access} onChange={(e) => setShareForm({ ...shareForm, access: e.target.value })}>
              <option value="read">Read</option>
              <option value="edit">Edit</option>
            </select>
            <button className="slds-button slds-button_brand" onClick={addShare}>Share</button>
          </div>
        </Modal>
      )}
      {preview && (
        <Modal title={preview.name} onClose={() => { URL.revokeObjectURL(preview.url); setPreview(null); }}>
          {preview.type.startsWith('image/') ? <img src={preview.url} alt={preview.name} style={{ maxWidth: '100%' }} /> : preview.type.startsWith('text/') || preview.type.includes('pdf') ? <iframe title={preview.name} src={preview.url} style={{ width: '100%', height: '60vh', border: 0 }} /> : <p>Preview is not available for this file type. <a href={preview.url} download={preview.name}>Download</a></p>}
        </Modal>
      )}
    </div>
  );
}
