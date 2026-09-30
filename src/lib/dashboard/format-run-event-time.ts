export function formatRunEventTime(
  iso: string,
  timeZone: string,
  locale?: string,
): string {
  const timestamp = Date.parse(iso)
  if (Number.isNaN(timestamp)) return iso

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(timestamp)
}
