import {
  LoadingScreen,
  PageHeaderSkeleton,
  SectionCardSkeleton,
  StatCardSkeleton,
} from "@/components/dashboard/loading-state"

export default function JarvisLoading() {
  return (
    <LoadingScreen label="Loading Jarvis">
      <PageHeaderSkeleton />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <SectionCardSkeleton withHeader bodyLines={3} />
    </LoadingScreen>
  )
}
