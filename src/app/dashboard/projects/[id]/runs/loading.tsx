import {
  LoadingScreen,
  PageHeaderSkeleton,
  RegistryRowsSkeleton,
} from "@/components/dashboard/loading-state"

export default function ProjectRunsLoading() {
  return (
    <LoadingScreen label="Loading project runs">
      <PageHeaderSkeleton eyebrow />
      <RegistryRowsSkeleton rows={6} />
    </LoadingScreen>
  )
}
