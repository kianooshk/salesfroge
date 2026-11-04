'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Chart } from '@/components/ui';

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api(`/reports/${params.id}/run`).then(setData).catch(() => setData(null));
  }, [params.id]);

  if (!data) return <p className="slds-p-around_medium">Loading report…</p>;

  return (
    <div>
      <div className="slds-page-header">
        <div className="slds-page-header__row">
          <div className="slds-page-header__col-title">
            <p className="slds-page-header__name-meta"><Link href="/reports">Reports</Link></p>
            <h1 className="slds-page-header__title">{data.report.name}</h1>
            <p className="sf-muted">{data.report.description || data.report.objectType} · {data.result.total} records</p>
          </div>
          <div className="slds-page-header__col-actions">
            <button className="slds-button slds-button_destructive" onClick={async () => { await api(`/reports/${params.id}`, { method: 'DELETE' }); router.push('/reports'); }}>Delete</button>
          </div>
        </div>
      </div>
      <article className="slds-card slds-m-top_medium">
        <div className="slds-card__body slds-card__body_inner">
          <Chart type={data.report.chartType || 'bar'} groups={data.result.groups} />
        </div>
      </article>
    </div>
  );
}
