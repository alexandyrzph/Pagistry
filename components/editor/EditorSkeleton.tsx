import { LogoMark } from "@/components/Brand";
import { Skeleton } from "@/components/ui/Skeleton";

export function EditorSkeleton() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-100">
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3">
        <LogoMark size={30} className="rounded-lg shadow-sm ring-1 ring-black/5" />
        <Skeleton className="hidden h-4 w-10 sm:block" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="ml-1 hidden h-8 w-28 rounded-lg lg:block" />
        <Skeleton className="mx-auto h-9 w-36 rounded-xl" />
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </header>

      <div className="flex min-h-0 flex-1">
        {/* icon rail */}
        <div className="flex w-[54px] shrink-0 flex-col items-center gap-2 border-r border-zinc-200 bg-white py-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-9 rounded-lg" />
          ))}
          <div className="mt-auto flex flex-col gap-2">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </div>

        {/* nested panel */}
        <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/60">
          <div className="flex h-11 shrink-0 items-center border-b border-zinc-200 px-3.5">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-6 p-3">
            {[0, 1, 2].map((g) => (
              <div key={g} className="space-y-2.5">
                <Skeleton className="h-2.5 w-16" />
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: g === 1 ? 6 : g === 2 ? 7 : 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* canvas with browser device frame */}
        <div className="flex flex-1 justify-center overflow-hidden p-6 lg:p-10">
          <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-zinc-200">
            <div className="flex h-9 shrink-0 items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3.5">
              <span className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-zinc-200" />
                <span className="h-3 w-3 rounded-full bg-zinc-200" />
                <span className="h-3 w-3 rounded-full bg-zinc-200" />
              </span>
              <Skeleton className="mx-auto h-5 w-1/2 max-w-sm rounded-md" />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <Skeleton className="h-72 rounded-none" />
              <div className="space-y-4 p-10">
                <Skeleton className="mx-auto h-8 w-2/3" />
                <Skeleton className="mx-auto h-4 w-1/2" />
                <div className="grid grid-cols-3 gap-4 pt-8">
                  <Skeleton className="h-40 rounded-xl" />
                  <Skeleton className="h-40 rounded-xl" />
                  <Skeleton className="h-40 rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
