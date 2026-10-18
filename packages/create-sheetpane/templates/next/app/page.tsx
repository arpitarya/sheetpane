'use client';
// The sheet runs in the browser only: the custom elements register on the client, so the
// component that renders them is loaded without server rendering.
import dynamic from 'next/dynamic';

const Review = dynamic(() => import('./review'), { ssr: false });

export default function Page() {
  return <Review />;
}
