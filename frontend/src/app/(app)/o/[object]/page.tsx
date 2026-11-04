'use client';

import { useParams } from 'next/navigation';
import ListScreen from '@/components/ListScreen';

export default function ObjectListPage() {
  const params = useParams<{ object: string }>();
  return <ListScreen objectKey={params.object} />;
}
