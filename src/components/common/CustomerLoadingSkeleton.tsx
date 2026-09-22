import type { CSSProperties } from 'react';

const Bone = ({ className, style }: { className: string; style?: CSSProperties }) => (
  <span aria-hidden="true" className={`skeleton-shimmer block ${className}`} style={style} />
);

export const MealCardsSkeleton = ({ count = 2 }: { count?: number }) => (
  <div role="status" aria-label="Loading fresh meals" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: count }, (_, index) => (
      <article key={index} className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="grid h-full sm:grid-cols-[190px_minmax(0,1fr)] md:block xl:grid xl:grid-cols-[190px_minmax(0,1fr)]">
          <Bone className="h-48 w-full sm:h-full sm:min-h-[238px] md:h-48 md:min-h-0 xl:h-full xl:min-h-[238px]" />
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-3"><Bone className="h-3 w-20 rounded-full" /><Bone className="h-6 w-4/5 rounded-lg" /></div>
              <Bone className="h-8 w-14 rounded-lg" />
            </div>
            <div className="mt-5 space-y-2"><Bone className="h-3 w-full rounded-full" /><Bone className="h-3 w-11/12 rounded-full" /><Bone className="h-3 w-2/3 rounded-full" /></div>
            <Bone className="mt-6 h-11 w-full rounded-xl" />
          </div>
        </div>
      </article>
    ))}
    <span className="sr-only">Kitchen menu is loading.</span>
  </div>
);

export const CustomerPageSkeleton = () => (
  <section role="status" aria-label="Loading page" className="mx-auto min-h-[55vh] w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
    <div className="space-y-3"><Bone className="h-3 w-24 rounded-full" /><Bone className="h-8 w-3/5 max-w-sm rounded-xl" /><Bone className="h-4 w-4/5 max-w-lg rounded-full" /></div>
    <div className="mt-7 flex gap-3 overflow-hidden"><Bone className="h-16 w-28 shrink-0 rounded-2xl" /><Bone className="h-16 w-28 shrink-0 rounded-2xl" /><Bone className="h-16 w-28 shrink-0 rounded-2xl" /></div>
    <div className="mt-7"><MealCardsSkeleton count={2} /></div>
    <span className="sr-only">Page content is loading.</span>
  </section>
);
