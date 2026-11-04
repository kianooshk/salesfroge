'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useApp } from '@/components/Shell';
import { Banner, Chart } from '@/components/ui';

const EMPTY = { name: '', objectType: 'Opportunity', groupBy: 'stage', aggregate: 'sum', aggregateField: 'amount', chartType: 'bar', filters: [] as any[] };

export default function ReportsPage() {
  const { objects } = useApp();
  const router = useRouter();
  const [reports, setReports] = useState<any[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const standard = objects.filter((object) => !object.custom);

  useEffect(() => { api('/reports').then(setReports).catch((err) => setError(err.message)); }, []);

  const meta = standard.find((object) => object.objectType === form.objectType);

  async function runPreview() {
    setError(null);
    try { setPreview(await api('/reports/preview', { method: 'POST', body: form })); }
    catch (err: any) { setError(err.message); }
  }

  async function save() {
    const report = await api('/reports', { method: 'POST', body: form });
    router.push(`/reports/${report.id}`);
  }

  return (
    <div>
      <Banner error={error} />
      <div className="slds-page-header"><h1 className="slds-page-header__title">Reports</h1></div>
      <div className="sf-two slds-m-top_medium">
        <article className="slds-card">
          <div className="slds-card__header"><h2 className="slds-card__header-title">Saved reports</h2></div>
          <ul className="slds-has-dividers_bottom-space slds-p-horizontal_small">
            {reports.map((report) => (
              <li key={report.id} className="slds-item"><Link href={`/reports/${report.id}`}>{report.name}</Link><div className="sf-muted">{report.objectType} · {report.chartType}</div></li>
            ))}
          </ul>
          <div className="slds-card__footer"><Link href="/dashboards">Dashboards</Link></div>
        </article>
        <article className="slds-card">
          <div className="slds-card__header"><h2 className="slds-card__header-title">New report</h2></div>
          <div className="slds-card__body slds-card__body_inner">
            <input className="slds-input slds-m-bottom_x-small" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="slds-select slds-m-bottom_x-small" value={form.objectType} onChange={(e) => setForm({ ...form, objectType: e.target.value, groupBy: '' })}>
              {standard.map((object) => <option key={object.objectType} value={object.objectType}>{object.plural}</option>)}
            </select>
            <select className="slds-select slds-m-bottom_x-small" value={form.groupBy} onChange={(e) => setForm({ ...form, groupBy: e.target.value })}>
              <option value="">No grouping</option>
              {(meta?.fields || []).filter((field: any) => ['picklist', 'text', 'date'].includes(field.type)).map((field: any) => <option key={field.name} value={field.name}>{field.label}</option>)}
            </select>
            <div className="slds-grid slds-gutters_x-small slds-m-bottom_x-small">
              <select className="slds-select" value={form.aggregate} onChange={(e) => setForm({ ...form, aggregate: e.target.value })}>
                <option value="count">Count</option>
                <option value="sum">Sum</option>
                <option value="avg">Average</option>
              </select>
              <select className="slds-select" value={form.aggregateField} onChange={(e) => setForm({ ...form, aggregateField: e.target.value })}>
                <option value="">Field</option>
                {(meta?.fields || []).filter((field: any) => field.type === 'number' || field.type === 'currency').map((field: any) => <option key={field.name} value={field.name}>{field.label}</option>)}
              </select>
              <select className="slds-select" value={form.chartType} onChange={(e) => setForm({ ...form, chartType: e.target.value })}>
                {['bar', 'pie', 'funnel', 'line', 'table'].map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <button className="slds-button slds-button_neutral" onClick={runPreview}>Run</button>
            <button className="slds-button slds-button_brand" disabled={!form.name} onClick={save}>Save</button>
            {preview && <div className="slds-m-top_medium"><Chart type={form.chartType} groups={preview.groups} /></div>}
          </div>
        </article>
      </div>
    </div>
  );
}
