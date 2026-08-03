export function SkeletonPost() {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3 w-32" />
          <div className="skeleton h-2 w-20" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-4/5" />
      </div>
      <div className="skeleton mt-4 h-44 w-full rounded-2xl" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3">
      <div className="skeleton h-9 w-9 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3 w-2/3" />
        <div className="skeleton h-2 w-1/3" />
      </div>
    </div>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="glass grid gap-3 rounded-2xl p-5">
      <div className="skeleton h-3 w-28" />
      {Array.from({ length: lines }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  );
}
