'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/components/Shell';
import { Banner } from '@/components/ui';

export default function ImportPage() {
  const { objects } = useApp();
  const targets = objects.filter((object) => !object.custom);
  const [objectType, setObjectType] = useState('Lead');
  const [csv, setCsv] = useState('First Name,Last Name,Company,Email,Status\nAda,Lovelace,Analytical Engines,ada@engines.example,New\n');
  const [preview, setPreview] = useState<any>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setCsv(await file.text());
  }

  async function runPreview() {
    setError(null);
    try {
      const data = await api('/import/preview', { method: 'POST', body: { objectType, csv } });
      setPreview(data);
      setMapping(data.mapping || {});
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function runImport() {
    setError(null);
    try {
      setResult(await api('/import', { method: 'POST', body: { objectType, csv, mapping } }));
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <Banner error={error} />
      <div className="slds-page-header"><h1 className="slds-page-header__title">Import CSV</h1><p className="sf-muted">Map columns, then import. List views can export the same objects.</p></div>
      <article className="slds-card slds-m-top_medium">
        <div className="slds-card__body slds-card__body_inner">
          <select className="slds-select slds-m-bottom_small" value={objectType} onChange={(e) => { setObjectType(e.target.value); setPreview(null); }}>
            {targets.map((object) => <option key={object.objectType} value={object.objectType}>{object.plural}</option>)}
          </select>
          <input type="file" accept=".csv,text/csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) onFile(file); }} />
          <textarea className="slds-textarea slds-m-top_small" rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} />
          <div className="slds-m-top_small">
            <button className="slds-button slds-button_neutral" onClick={runPreview}>Preview mapping</button>
            <button className="slds-button slds-button_brand" disabled={!preview} onClick={runImport}>Import</button>
          </div>
          {preview && (
            <div className="slds-m-top_medium">
              <p>{preview.rowCount} rows. Sample mapping:</p>
              {preview.headers.map((header: string) => (
                <div key={header} className="slds-grid slds-grid_vertical-align-center slds-m-bottom_xx-small">
                  <div className="slds-col slds-size_1-of-2">{header}</div>
                  <select className="slds-select" value={mapping[header] || ''} onChange={(e) => setMapping({ ...mapping, [header]: e.target.value })}>
                    <option value="">Skip</option>
                    {preview.fields.map((field: any) => <option key={field.name} value={field.name}>{field.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
          {result && <p className="slds-m-top_medium">Created {result.created}. Failed {result.failed}. {result.errors?.map((item: any) => `Row ${item.row}: ${item.message}`).join(' ')}</p>}
        </div>
      </article>
    </div>
  );
}
