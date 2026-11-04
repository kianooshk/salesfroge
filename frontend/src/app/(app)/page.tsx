'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { dateFmt, person, titleOf } from '@/lib/format';
import { useApp } from '@/components/Shell';
import { Chart } from '@/components/ui';

export default function HomePage() {
  const { me } = useApp();
  const [summary, setSummary] = useState<any>(null);
  const [feed, setFeed] = useState<any[]>([]);

  useEffect(() => {
    api('/dashboard/summary').then(setSummary).catch(() => setSummary(null));
    api('/feed').then(setFeed).catch(() => setFeed([]));
  }, []);

  const cards = summary
    ? [
        ['Leads', summary.counts.leads, '/o/leads'],
        ['Accounts', summary.counts.accounts, '/o/accounts'],
        ['Contacts', summary.counts.contacts, '/o/contacts'],
        ['Opportunities', summary.counts.opportunities, '/pipeline'],
        ['Open cases', summary.counts.openCases, '/o/cases'],
      ]
    : [];

  return (
    <div>
      <div className="slds-page-header">
        <div className="slds-media">
          <div className="slds-media__body">
            <p className="slds-page-header__name-meta">Home</p>
            <h1 className="slds-page-header__title">Good to see you, {me.firstName}</h1>
          </div>
        </div>
      </div>
      <div className="sf-stat-grid slds-m-top_medium">
        {cards.map(([label, value, href]) => (
          <Link key={label} href={href as string} className="sf-stat" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="sf-muted">{label}</span>
            <b>{value as number}</b>
          </Link>
        ))}
      </div>
      <div className="sf-two slds-m-top_medium">
        <article className="slds-card">
          <div className="slds-card__header slds-grid slds-grid_align-spread">
            <h2 className="slds-card__header-title">Pipeline</h2>
            <Link href="/pipeline">Open kanban</Link>
          </div>
          <div className="slds-card__body slds-card__body_inner">
            {summary && <Chart type="funnel" groups={summary.pipeline.groups} />}
          </div>
        </article>
        <article className="slds-card">
          <div className="slds-card__header"><h2 className="slds-card__header-title">My open tasks</h2></div>
          <ul className="slds-has-dividers_bottom-space slds-p-horizontal_small">
            {(summary?.myTasks || []).map((task: any) => (
              <li key={task.id} className="slds-item">
                <Link href={`/o/activities/${task.id}`}>{task.subject}</Link>
                <div className="sf-muted">Due {dateFmt(task.dueDate)}</div>
              </li>
            ))}
            {summary && summary.myTasks.length === 0 && <li className="slds-item sf-muted">No open tasks assigned to you.</li>}
          </ul>
        </article>
      </div>
      <div className="sf-two slds-m-top_medium">
        <article className="slds-card">
          <div className="slds-card__header"><h2 className="slds-card__header-title">Leads by status</h2></div>
          <div className="slds-card__body slds-card__body_inner">{summary && <Chart type="bar" groups={summary.leadsByStatus.groups} />}</div>
        </article>
        <article className="slds-card">
          <div className="slds-card__header slds-grid slds-grid_align-spread">
            <h2 className="slds-card__header-title">Company feed</h2>
            <Link href="/feed">Open</Link>
          </div>
          <ul className="slds-has-dividers_bottom-space slds-p-horizontal_small">
            {feed.slice(0, 4).map((item) => (
              <li key={item.id} className="slds-item">
                <strong>{person(item.author)}</strong>
                <div>{titleOf({ name: item.body.slice(0, 140) })}</div>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </div>
  );
}
