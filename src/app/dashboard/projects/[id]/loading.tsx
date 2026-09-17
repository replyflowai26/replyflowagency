import {
  LoadingScreen,
  PageHeaderSkeleton,
  RegistryRowsSkeleton,
  SectionCardSkeleton,
  SkeletonBlock,
} from "@/components/dashboard/loading-state"

export default function ProjectDetailLoading() {
  return (
    <LoadingScreen label="Loading project detail">
      <PageHeaderSkeleton eyebrow />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-[#090c12]/80 p-5">
          <SkeletonBlock className="h-3 w-28" />
          <SkeletonBlock className="mt-4 h-4 w-2/3" />
          <SkeletonBlock className="mt-2 h-3 w-3/4" />
        </div>
        <SkeletonBlock className="h-6 w-20 rounded-full" />
      </div>
      <div className="mb-6">
        <SectionCardSkeleton withHeader bodyLines={2} />
      </div>
      <RegistryRowsSkeleton rows={4} />
    </LoadingScreen>
  )
}
