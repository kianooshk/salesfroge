'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { money, person } from '@/lib/format';
import { Banner } from '@/components/ui';

export default function PipelinePage() {
  const [board, setBoard] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api('/opportunities/board').then(setBoard).catch((err) => setError(err.message));
  }
  useEffect(() => { load(); }, []);

  async function drop(event: React.DragEvent, stage: string) {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    if (!id) return;
    await api(`/opportunities/${id}`, { method: 'PATCH', body: { stage } });
    load();
  }

  return (
    <div>
      <Banner error={error} />
      <div className="slds-page-header">
        <div className="slds-page-header__row">
          <div className="slds-page-header__col-title">
            <h1 className="slds-page-header__title">Pipeline</h1>
            <p className="sf-muted">Drag a card to change its stage.</p>
          </div>
          <div className="slds-page-header__col-actions">
            <Link className="slds-button slds-button_neutral" href="/o/opportunities">List view</Link>
          </div>
        </div>
      </div>
      <div className="sf-kanban slds-m-top_medium">
        {(board?.stages || []).map((stage: any) => (
          <section key={stage.name} className="sf-kanban-col" onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, stage.name)}>
            <div className="sf-kanban-head">
              <span>{stage.name}</span>
              <span className="sf-muted">{stage.count}</span>
            </div>
            <div className="sf-muted slds-p-horizontal_small">{money(stage.total)} · {stage.probability}%</div>
            {stage.records.map((record: any) => (
              <Link
                key={record.id}
                href={`/o/opportunities/${record.id}`}
                className="sf-kanban-card"
                draggable
                onDragStart={(event) => event.dataTransfer.setData('text/plain', record.id)}
              >
                <strong>{record.name}</strong>
                <div className="sf-muted">{record.account?.name || 'No account'}</div>
                <div>{money(record.amount)}</div>
                <div className="sf-muted">{person(record.owner)}</div>
              </Link>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
