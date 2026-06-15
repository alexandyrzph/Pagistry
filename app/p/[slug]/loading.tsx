import { Skeleton } from "@/components/ui/Skeleton";

export default function PublicLoading() {
  return (
    <main>
      <Skeleton className="h-[440px] w-full rounded-none" />
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <Skeleton className="mx-auto h-8 w-1/2" />
          <Skeleton className="mx-auto h-4 w-2/3" />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-zinc-100 p-7">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
