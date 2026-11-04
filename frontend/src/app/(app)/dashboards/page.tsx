'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function DashboardsPage() {
  const router = useRouter();
  const [dashboards, setDashboards] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [name, setName] = useState('My dashboard');
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    api('/dashboards').then(setDashboards);
    api('/reports').then(setReports);
  }, []);

  async function create() {
    const dashboard = await api('/dashboards', { method: 'POST', body: { name, widgets: selected.map((reportId) => ({ reportId })) } });
    router.push(`/dashboards/${dashboard.id}`);
  }

  return (
    <div>
      <div className="slds-page-header"><h1 className="slds-page-header__title">Dashboards</h1></div>
      <div className="sf-two slds-m-top_medium">
        <ul className="slds-has-dividers_around-space">
          {dashboards.map((dashboard) => <li key={dashboard.id} className="slds-item"><Link href={`/dashboards/${dashboard.id}`}>{dashboard.name}</Link></li>)}
          {dashboards.length === 0 && <li className="slds-item sf-muted">No dashboards yet.</li>}
        </ul>
        <article className="slds-card">
          <div className="slds-card__header"><h2 className="slds-card__header-title">New dashboard</h2></div>
          <div className="slds-card__body slds-card__body_inner">
            <input className="slds-input slds-m-bottom_small" value={name} onChange={(e) => setName(e.target.value)} />
            {reports.map((report) => (
              <label key={report.id} className="slds-checkbox slds-m-bottom_xx-small" style={{ display: 'block' }}>
                <input type="checkbox" checked={selected.includes(report.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, report.id] : selected.filter((id) => id !== report.id))} />
                <span className="slds-form-element__label">{report.name}</span>
              </label>
            ))}
            <button className="slds-button slds-button_brand slds-m-top_small" onClick={create}>Create</button>
          </div>
        </article>
      </div>
    </div>
  );
}
