import {
  LoadingScreen,
  SectionCardSkeleton,
  SkeletonBlock,
} from "@/components/dashboard/loading-state"

export default function RunDetailLoading() {
  return (
    <LoadingScreen label="Loading run detail">
      <div className="mb-8">
        <SkeletonBlock className="h-3 w-32" />
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <SkeletonBlock className="h-8 w-64 max-w-full" />
          <SkeletonBlock className="h-3 w-20" />
        </div>
        <SkeletonBlock className="mt-2 h-3 w-48" />
      </div>
      <div className="mb-6">
        <SectionCardSkeleton bodyLines={4} />
      </div>
      <SectionCardSkeleton withHeader bodyLines={2} />
    </LoadingScreen>
  )
}
