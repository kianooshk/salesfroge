'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, downloadExport } from '@/lib/api';
import { cell, splitPayload } from '@/lib/format';
import { useApp } from './Shell';
import { IconBox } from './Icon';
import { Banner, Fields, Modal } from './ui';

const OPS = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
];

export default function ListScreen({ objectKey }: { objectKey: string }) {
  const { objects, users, me } = useApp();
  const meta = objects.find((object) => object.key === objectKey);
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [views, setViews] = useState<any[]>([]);
  const [viewId, setViewId] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<{ field: string; op: string; value: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [accounts, setAccounts] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [savingView, setSavingView] = useState(false);
  const [viewName, setViewName] = useState('');

  async function load(nextView = viewId, nextSearch = search, nextFilters = filters) {
    if (!meta) return;
    const params = new URLSearchParams();
    if (nextSearch) params.set('search', nextSearch);
    if (nextView) params.set('viewId', nextView);
    else if (nextFilters.length) params.set('filters', JSON.stringify(nextFilters.filter((filter) => filter.field && filter.value)));
    const data = await api(`${meta.endpoint}?${params.toString()}`);
    setRows(data);
  }

  useEffect(() => {
    if (!meta) return;
    api(`/views?objectType=${encodeURIComponent(meta.objectType)}`).then(setViews).catch(() => setViews([]));
    load('', '', []).catch((err) => setError(err.message));
    if (meta.fields.some((field: any) => field.lookup === 'account')) api('/accounts').then(setAccounts).catch(() => undefined);
    if (meta.fields.some((field: any) => field.lookup === 'contact')) api('/contacts').then(setContacts).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.key]);

  if (!meta) return <p>That object is not available.</p>;

  function openCreate() {
    const next: Record<string, any> = { ownerId: me.id };
    const status = meta.fields.find((field: any) => field.name === 'status');
    const stage = meta.fields.find((field: any) => field.name === 'stage');
    if (status?.options?.[0]) next.status = status.options[0];
    if (stage?.options?.[0]) next.stage = stage.options[0];
    if (meta.key === 'activities') next.type = 'Task';
    if (meta.key === 'cases') next.priority = 'Medium';
    setForm(next);
    setCreating(true);
  }

  async function create() {
    setError(null);
    try {
      const created = await api(meta.endpoint, { method: 'POST', body: splitPayload(meta, form) });
      setCreating(false);
      router.push(`/o/${meta.key}/${created.id}`);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function saveView() {
    if (!viewName.trim()) return;
    const view = await api('/views', {
      method: 'POST',
      body: { name: viewName, objectType: meta.objectType, filters: filters.filter((filter) => filter.field), isShared: true },
    });
    setViews((current) => [...current, view]);
    setViewId(view.id);
    setSavingView(false);
    setViewName('');
  }

  return (
    <div>
      <Banner error={error} />
      <div className="slds-page-header">
        <div className="slds-page-header__row">
          <div className="slds-page-header__col-title">
            <div className="slds-media">
              <div className="slds-media__figure"><IconBox name={meta.icon || 'custom'} /></div>
              <div className="slds-media__body">
                <p className="slds-page-header__name-meta">{meta.plural}</p>
                <h1 className="slds-page-header__title">{viewId ? views.find((view) => view.id === viewId)?.name : `All ${meta.plural}`}</h1>
                <p className="sf-muted">{rows.length} items</p>
              </div>
            </div>
          </div>
          <div className="slds-page-header__col-actions">
            <div className="slds-button-group" role="group">
              {meta.supportsKanban && <Link className="slds-button slds-button_neutral" href="/pipeline">Kanban</Link>}
              {!meta.custom && <button className="slds-button slds-button_neutral" onClick={() => downloadExport(meta.objectType, viewId ? `?viewId=${viewId}` : '')}>Export</button>}
              <button className="slds-button slds-button_brand" onClick={openCreate}>New</button>
            </div>
          </div>
        </div>
        <div className="slds-page-header__row slds-m-top_small slds-grid slds-wrap slds-grid_vertical-align-end">
          <div className="slds-col slds-m-right_small">
            <label className="slds-form-element__label">List view</label>
            <select className="slds-select" value={viewId} onChange={(event) => { setViewId(event.target.value); setFilters([]); load(event.target.value, search, []); }}>
              <option value="">All {meta.plural}</option>
              {views.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
            </select>
          </div>
          <div className="slds-col slds-grow">
            <label className="slds-form-element__label">Search this list</label>
            <input className="slds-input" value={search} placeholder="Search" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') load(viewId, search, filters); }} />
          </div>
        </div>
      </div>

      <div className="slds-box slds-m-top_small slds-theme_default">
        <div className="slds-grid slds-grid_align-spread slds-m-bottom_x-small">
          <strong>Filters</strong>
          <div>
            <button className="slds-button slds-button_neutral" onClick={() => setFilters([...filters, { field: meta.fields[0]?.name || 'name', op: 'eq', value: '' }])}>Add filter</button>
            <button className="slds-button slds-button_neutral" onClick={() => { setViewId(''); load('', search, filters); }}>Apply</button>
            <button className="slds-button slds-button_neutral" onClick={() => setSavingView(true)}>Save view</button>
          </div>
        </div>
        {filters.map((filter, index) => (
          <div key={index} className="slds-grid slds-gutters_x-small slds-m-bottom_x-small">
            <div className="slds-col">
              <select className="slds-select" value={filter.field} onChange={(event) => setFilters(filters.map((item, i) => i === index ? { ...item, field: event.target.value } : item))}>
                {meta.fields.filter((field: any) => field.type !== 'textarea').map((field: any) => <option key={field.name} value={field.name}>{field.label}</option>)}
              </select>
            </div>
            <div className="slds-col">
              <select className="slds-select" value={filter.op} onChange={(event) => setFilters(filters.map((item, i) => i === index ? { ...item, op: event.target.value } : item))}>
                {OPS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
              </select>
            </div>
            <div className="slds-col slds-grow">
              <input className="slds-input" value={filter.value} onChange={(event) => setFilters(filters.map((item, i) => i === index ? { ...item, value: event.target.value } : item))} />
            </div>
            <button className="slds-button slds-button_icon" title="Remove filter" onClick={() => setFilters(filters.filter((_, i) => i !== index))}>×</button>
          </div>
        ))}
        {filters.length === 0 && <p className="sf-muted">No extra filters. Choose a saved view or add one.</p>}
      </div>

      <div className="slds-card slds-m-top_small">
        <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_striped sf-table">
          <thead>
            <tr>{meta.columns.map((column: any) => <th key={column.name} scope="col">{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {meta.columns.map((column: any, index: number) => (
                  <td key={column.name} data-label={column.label}>
                    {index === 0 ? <Link href={`/o/${meta.key}/${row.id}`}>{cell(row, column.name)}</Link> : cell(row, column.name)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={meta.columns.length}>No records yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {creating && (
        <Modal
          title={`New ${meta.label}`}
          onClose={() => setCreating(false)}
          footer={<><button className="slds-button slds-button_neutral" onClick={() => setCreating(false)}>Cancel</button><button className="slds-button slds-button_brand" onClick={create}>Save</button></>}
        >
          <Fields fields={meta.fields} value={form} onChange={setForm} users={users} accounts={accounts} contacts={contacts} stages={meta.stages} />
        </Modal>
      )}
      {savingView && (
        <Modal title="Save list view" onClose={() => setSavingView(false)} footer={<><button className="slds-button slds-button_neutral" onClick={() => setSavingView(false)}>Cancel</button><button className="slds-button slds-button_brand" onClick={saveView}>Save</button></>}>
          <label className="slds-form-element__label">View name</label>
          <input className="slds-input" value={viewName} onChange={(event) => setViewName(event.target.value)} />
        </Modal>
      )}
    </div>
  );
}
