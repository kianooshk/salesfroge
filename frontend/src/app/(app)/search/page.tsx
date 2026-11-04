'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';

function SearchResults() {
  const params = useSearchParams();
  const q = params.get('q') || '';
  const [results, setResults] = useState<any[]>([]);
  useEffect(() => { if (q) api(`/search?q=${encodeURIComponent(q)}`).then(setResults); }, [q]);
  return (
    <div>
      <div className="slds-page-header">
        <h1 className="slds-page-header__title">Search</h1>
        <p className="sf-muted">{results.length} results for “{q}”</p>
      </div>
      <ul className="slds-has-dividers_bottom-space slds-m-top_medium">
        {results.map((result) => (
          <li key={`${result.type}-${result.id}`} className="slds-item slds-p-around_small">
            <div className="sf-muted">{result.type}</div>
            <Link href={result.href}>{result.title}</Link>
            {result.subtitle && <div>{result.subtitle}</div>}
          </li>
        ))}
        {q && results.length === 0 && <li className="slds-item">Nothing matched.</li>}
      </ul>
    </div>
  );
}

export default function SearchPage() {
  return <Suspense fallback={<p>Searching…</p>}><SearchResults /></Suspense>;
}
