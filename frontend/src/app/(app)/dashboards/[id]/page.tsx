'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Chart } from '@/components/ui';

export default function DashboardPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  useEffect(() => { api(`/dashboards/${params.id}`).then(setData); }, [params.id]);
  if (!data) return <p className="slds-p-around_medium">Loading dashboard…</p>;
  return (
    <div>
      <div className="slds-page-header">
        <p className="slds-page-header__name-meta"><Link href="/dashboards">Dashboards</Link></p>
        <h1 className="slds-page-header__title">{data.name}</h1>
      </div>
      <div className="slds-grid slds-wrap slds-m-top_medium">
        {data.results.map((widget: any) => (
          <div key={widget.report.id} className="slds-col slds-size_1-of-1 slds-large-size_1-of-2 slds-p-around_x-small">
            <article className="slds-card">
              <div className="slds-card__header"><h2 className="slds-card__header-title"><Link href={`/reports/${widget.report.id}`}>{widget.report.name}</Link></h2></div>
              <div className="slds-card__body slds-card__body_inner"><Chart type={widget.report.chartType} groups={widget.result.groups} /></div>
            </article>
          </div>
        ))}
      </div>
    </div>
  );
}
