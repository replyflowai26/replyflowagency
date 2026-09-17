import {
  LoadingScreen,
  PageHeaderSkeleton,
  SectionCardSkeleton,
  StatCardSkeleton,
} from "@/components/dashboard/loading-state"

export default function ClientDetailLoading() {
  return (
    <LoadingScreen label="Loading client detail">
      <PageHeaderSkeleton />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <SectionCardSkeleton withHeader bodyLines={2} />
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <SectionCardSkeleton withHeader />
        <SectionCardSkeleton withHeader />
      </div>
    </LoadingScreen>
  )
}
