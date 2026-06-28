/**
 * Map a `news_items` DB row to the public Radio Core API shape.
 * Keep field names camelCase as specified by the integration contract.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapNewsItem(row: any) {
  return {
    id: row.id,
    title: row.title,
    shortTitle: row.short_title,
    summary: row.summary,
    fullArticle: row.full_article,
    radioScript: row.radio_script,
    region: row.region,
    municipality: row.municipality,
    category: row.category,
    priority: row.priority,
    language: row.language,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
    source: row.source,
    tags: row.tags ?? [],
    estimatedDuration: row.estimated_duration_seconds,
    audioUrl: row.audio_url ?? null,
    audioPending: !row.audio_url,
    imageUrl: row.image_url ?? null,
    status: row.status,
  };
}
