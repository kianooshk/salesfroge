'use client';

import { useParams } from 'next/navigation';
import RecordScreen from '@/components/RecordScreen';

export default function ObjectRecordPage() {
  const params = useParams<{ object: string; id: string }>();
  return <RecordScreen objectKey={params.object} id={params.id} />;
}
