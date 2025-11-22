interface ArticleMetadataProps {
  author: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export function ArticleMetadata({
  author,
  createdAt,
  updatedAt,
  updatedBy,
}: ArticleMetadataProps) {
  // If no metadata is available, don't render anything
  if (!author && !createdAt && !updatedAt && !updatedBy) {
    return null;
  }

  const createdDate = createdAt ? formatDate(createdAt) : null;
  const updatedDate = updatedAt ? formatDate(updatedAt) : null;

  return (
    <div className="text-gray-600 text-sm" style={{ marginBottom: '1rem' }}>
      {author && createdDate && (
        <>Created by {author} on {createdDate}.</>
      )}
      {updatedBy && updatedDate && (
        <> Last updated by {updatedBy} on {updatedDate}.</>
      )}
    </div>
  );
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}
