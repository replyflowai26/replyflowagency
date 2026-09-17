import {
  LoadingScreen,
  PageHeaderSkeleton,
  RegistryRowsSkeleton,
  SectionCardSkeleton,
} from "@/components/dashboard/loading-state"

export default function ClientsLoading() {
  return (
    <LoadingScreen label="Loading clients">
      <PageHeaderSkeleton />
      <div className="mb-6">
        <SectionCardSkeleton withHeader bodyLines={2} />
      </div>
      <RegistryRowsSkeleton rows={6} />
    </LoadingScreen>
  )
}
