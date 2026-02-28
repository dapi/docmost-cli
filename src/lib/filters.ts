/**
 * Filter functions to extract only relevant information from API responses
 * for better agent consumption
 */

export function filterWorkspace(data: any) {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    defaultSpaceId: data.defaultSpaceId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    deletedAt: data.deletedAt,
  };
}

export function filterSpace(space: any) {
  return {
    id: space.id,
    name: space.name,
    description: space.description,
    slug: space.slug,
    visibility: space.visibility,
    createdAt: space.createdAt,
    updatedAt: space.updatedAt,
    deletedAt: space.deletedAt,
  };
}

export function filterGroup(group: any) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    workspaceId: group.workspaceId,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    deletedAt: group.deletedAt,
  };
}

export function filterPage(page: any, content?: string, subpages?: any[]) {
  return {
    id: page.id,
    title: page.title,
    parentPageId: page.parentPageId,
    spaceId: page.spaceId,
    isLocked: page.isLocked,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    deletedAt: page.deletedAt,
    // Include converted markdown content if valid string (even empty)
    ...(typeof content === "string" && { content }),
    // Include subpages if provided
    ...(subpages &&
      subpages.length > 0 && {
        subpages: subpages.map((p) => ({ id: p.id, title: p.title })),
      }),
  };
}

export function filterSearchResult(result: any) {
  return {
    id: result.id,
    title: result.title,
    parentPageId: result.parentPageId,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
    rank: result.rank,
    highlight: result.highlight,
    spaceId: result.space?.id,
    spaceName: result.space?.name,
  };
}

export function filterHistoryEntry(entry: any) {
  return {
    id: entry.id,
    pageId: entry.pageId,
    title: entry.title,
    version: entry.version,
    createdAt: entry.createdAt,
    lastUpdatedBy: entry.lastUpdatedBy?.name || entry.lastUpdatedById,
    contributors: entry.contributors?.map((c: any) => c.name) || [],
  };
}

export function filterMember(member: any) {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    createdAt: member.createdAt,
  };
}

export function filterInvite(invite: any) {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    invitedById: invite.invitedById,
    createdAt: invite.createdAt,
  };
}

export function filterUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    locale: user.locale,
    createdAt: user.createdAt,
  };
}

export function filterComment(comment: any) {
  return {
    id: comment.id,
    pageId: comment.pageId,
    content: comment.content,
    selection: comment.selection,
    parentCommentId: comment.parentCommentId,
    creatorId: comment.creatorId,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

export function filterShare(share: any) {
  return {
    id: share.id,
    pageId: share.pageId,
    includeSubPages: share.includeSubPages,
    searchIndexing: share.searchIndexing,
    createdAt: share.createdAt,
  };
}

export function filterHistoryDetail(entry: any, content?: string) {
  return {
    ...filterHistoryEntry(entry),
    ...(typeof content === "string" && { content }),
  };
}
