'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { dateTimeFmt, person } from '@/lib/format';
import { useApp } from '@/components/Shell';
import { Avatar, MentionComposer, RichText } from '@/components/ui';

export default function FeedPage() {
  const { users, refreshNotifications } = useApp();
  const [items, setItems] = useState<any[]>([]);

  function load() { api('/feed').then(setItems); }
  useEffect(() => { load(); }, []);

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="slds-page-header"><h1 className="slds-page-header__title">Company feed</h1></div>
      <div className="slds-m-top_medium">
        <MentionComposer users={users} placeholder="What is happening? Mention a teammate with @" button="Share" onSubmit={async (body) => { await api('/feed', { method: 'POST', body: { body } }); refreshNotifications(); load(); }} />
      </div>
      <div className="slds-m-top_large">
        {items.map((item) => (
          <article key={item.id} className="slds-post slds-card slds-m-bottom_medium slds-p-around_medium">
            <header className="slds-media">
              <div className="slds-media__figure"><Avatar user={item.author} /></div>
              <div className="slds-media__body">
                <h2>{person(item.author)}</h2>
                <p className="sf-muted">{dateTimeFmt(item.createdAt)}{item.relatedType ? ` · ${item.relatedType}` : ''}</p>
              </div>
            </header>
            <div className="slds-post__content slds-m-top_small"><RichText body={item.body} /></div>
            <ul className="slds-m-top_small">
              {(item.comments || []).map((comment: any) => <li key={comment.id} className="slds-m-bottom_xx-small"><strong>{person(comment.author)}</strong> <RichText body={comment.body} /></li>)}
            </ul>
            <div className="slds-m-top_small">
              <MentionComposer users={users} placeholder="Comment" button="Comment" onSubmit={async (body) => { await api(`/feed/${item.id}/comments`, { method: 'POST', body: { body } }); load(); }} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
