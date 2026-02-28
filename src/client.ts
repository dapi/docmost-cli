import { createReadStream } from "fs";
import FormData from "form-data";
import axios, { AxiosInstance } from "axios";
import {
  filterWorkspace,
  filterSpace,
  filterGroup,
  filterPage,
  filterSearchResult,
  filterHistoryEntry,
  filterHistoryDetail,
  filterMember,
  filterInvite,
  filterUser,
  filterComment,
  filterShare,
} from "./lib/filters.js";
import { convertProseMirrorToMarkdown } from "./lib/markdown-converter.js";
import { updatePageContentRealtime } from "./lib/collaboration.js";
import { getCollabToken, performLogin } from "./lib/auth-utils.js";
import { marked } from "marked";
import { generateJSON } from "@tiptap/html";
import { tiptapExtensions } from "./lib/tiptap-extensions.js";

function markdownToProseMirrorJson(markdown: string): object {
  const html = marked.parse(markdown, { async: false }) as string;
  return generateJSON(html, tiptapExtensions);
}

export type ClientAuthOptions = {
  email?: string;
  password?: string;
  token?: string;
};

export class DocmostClient {
  private readonly client: AxiosInstance;
  private readonly baseURL: string;
  private readonly auth: ClientAuthOptions;
  private token: string | null;

  constructor(baseURL: string, auth: ClientAuthOptions = {}) {
    this.baseURL = baseURL.replace(/\/+$/, "");
    this.auth = auth;
    this.token = auth.token ?? null;

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (this.token) {
      this.client.defaults.headers.common["Authorization"] =
        `Bearer ${this.token}`;
    }
  }

  async login() {
    if (this.token) {
      return;
    }

    if (!this.auth.email || !this.auth.password) {
      throw new Error("Missing credentials. Provide token or email/password.");
    }

    this.token = await performLogin(
      this.baseURL,
      this.auth.email,
      this.auth.password,
    );
    this.client.defaults.headers.common["Authorization"] =
      `Bearer ${this.token}`;
  }

  async ensureAuthenticated() {
    if (!this.token) {
      await this.login();
    }
  }

  async paginateAll<T = unknown>(
    endpoint: string,
    basePayload: Record<string, unknown> = {},
    limit: number = 100,
    maxItems: number = Infinity,
  ): Promise<T[]> {
    await this.ensureAuthenticated();

    const clampedLimit = Math.max(1, Math.min(100, limit));

    let page = 1;
    let allItems: T[] = [];
    let hasNextPage = true;

    while (hasNextPage && allItems.length < maxItems) {
      const response = await this.client.post(endpoint, {
        ...basePayload,
        limit: clampedLimit,
        page,
      });

      const data = response.data;
      const inner = data.data ?? data;
      const items = inner.items;
      if (!Array.isArray(items)) {
        throw new Error(
          `Unexpected API response from ${endpoint}: missing items array`,
        );
      }
      const meta = inner.meta;

      allItems = allItems.concat(items);
      hasNextPage = meta?.hasNextPage ?? false;
      page++;
    }

    return maxItems < Infinity ? allItems.slice(0, maxItems) : allItems;
  }

  async getWorkspace() {
    await this.ensureAuthenticated();
    const response = await this.client.post("/workspace/info", {});
    return {
      data: filterWorkspace(response.data.data),
      success: response.data.success,
    };
  }

  async getSpaces() {
    const spaces = await this.paginateAll("/spaces", {});
    return spaces.map((space) => filterSpace(space));
  }

  async getGroups() {
    const groups = await this.paginateAll("/groups", {});
    return groups.map((group) => filterGroup(group));
  }

  async listPages(spaceId?: string) {
    const payload = spaceId ? { spaceId } : {};
    const pages = await this.paginateAll("/pages/recent", payload);
    return pages.map((page) => filterPage(page));
  }

  async listSidebarPages(spaceId: string, pageId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/pages/sidebar-pages", {
      spaceId,
      pageId,
      page: 1,
    });
    return response.data?.data?.items ?? [];
  }

  async getPage(pageId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/pages/info", { pageId });
    const resultData = response.data.data;

    let content = resultData.content
      ? convertProseMirrorToMarkdown(resultData.content)
      : "";

    let subpages: any[] = [];

    try {
      subpages = await this.listSidebarPages(resultData.spaceId, pageId);
    } catch (error) {
      if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
        throw error;
      }
      const msg = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Warning: failed to fetch subpages: ${msg}\n`);
    }

    if (content && content.includes("{{SUBPAGES}}")) {
      if (subpages.length > 0) {
        const list = subpages
          .map((p: any) => `- [${p.title}](page:${p.id})`)
          .join("\n");
        content = content.replaceAll("{{SUBPAGES}}", `### Subpages\n${list}`);
      } else {
        content = content.replaceAll("{{SUBPAGES}}", "");
      }
    }

    return {
      data: filterPage(resultData, content, subpages),
      success: response.data.success,
    };
  }

  async createPage(spaceId: string, title?: string, icon?: string, parentPageId?: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/pages/create", {
      spaceId,
      ...(title && { title }),
      ...(icon && { icon }),
      ...(parentPageId && { parentPageId }),
    });
    return response.data.data ?? response.data;
  }

  async getPageTree(spaceId?: string, pageId?: string) {
    await this.ensureAuthenticated();
    if (!spaceId && !pageId) throw new Error("At least one of spaceId or pageId is required");
    const payload: Record<string, string> = {};
    if (spaceId) payload.spaceId = spaceId;
    if (pageId) payload.pageId = pageId;
    const response = await this.client.post("/pages/sidebar-pages", { ...payload, page: 1 });
    return response.data?.data?.items ?? [];
  }

  async movePageToSpace(pageId: string, spaceId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/pages/move-to-space", { pageId, spaceId });
    return response.data;
  }

  async exportPage(pageId: string, format: string, includeChildren?: boolean, includeAttachments?: boolean) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/pages/export", {
      pageId, format,
      ...(includeChildren !== undefined && { includeChildren }),
      ...(includeAttachments !== undefined && { includeAttachments }),
    }, { responseType: "arraybuffer" });
    return response.data;
  }

  async importPage(filePath: string, spaceId: string) {
    await this.ensureAuthenticated();
    const form = new FormData();
    form.append("spaceId", spaceId);
    form.append("file", createReadStream(filePath));
    const response = await axios.post(`${this.baseURL}/pages/import`, form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${this.token}` },
    });
    return response.data;
  }

  async importZip(filePath: string, spaceId: string, source: string) {
    await this.ensureAuthenticated();
    const form = new FormData();
    form.append("spaceId", spaceId);
    form.append("source", source);
    form.append("file", createReadStream(filePath));
    const response = await axios.post(`${this.baseURL}/pages/import-zip`, form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${this.token}` },
    });
    return response.data;
  }

  async updatePage(pageId: string, content?: string, title?: string, icon?: string) {
    await this.ensureAuthenticated();

    const metadata: Record<string, string> = { pageId };
    if (title !== undefined) metadata.title = title;
    if (icon !== undefined) metadata.icon = icon;
    if (Object.keys(metadata).length > 1) {
      await this.client.post("/pages/update", metadata);
    }

    if (content) {
      let collabToken = "";
      try {
        collabToken = await getCollabToken(this.baseURL, this.token!);
        await updatePageContentRealtime(pageId, content, collabToken, this.baseURL);
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          throw error;
        }
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to update page content: ${msg}`, { cause: error });
      }
    }

    return {
      success: true,
      modified: true,
      message: "Page updated successfully.",
      pageId,
    };
  }

  async search(query: string, spaceId?: string, creatorId?: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/search", {
      query,
      ...(spaceId && { spaceId }),
      ...(creatorId && { creatorId }),
    });

    const items = response.data?.data?.items ?? [];
    const filteredItems = Array.isArray(items)
      ? items.map((item: any) => filterSearchResult(item))
      : [];

    return {
      items: filteredItems,
    };
  }

  async movePage(
    pageId: string,
    parentPageId: string | null,
    position?: string,
  ) {
    await this.ensureAuthenticated();
    const validPosition = position || "a00000";

    const response = await this.client.post("/pages/move", {
      pageId,
      parentPageId,
      position: validPosition,
    });
    return response.data;
  }

  async deletePage(pageId: string, permanentlyDelete: boolean = false) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/pages/delete", {
      pageId,
      permanentlyDelete,
    });
    return response.data;
  }

  async deletePages(pageIds: string[]) {
    await this.ensureAuthenticated();
    const results: { id: string; success: boolean; error?: string }[] = [];
    for (const id of pageIds) {
      try {
        await this.client.post("/pages/delete", { pageId: id });
        results.push({ id, success: true });
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          throw error;
        }
        const msg = error instanceof Error ? error.message : String(error);
        results.push({ id, success: false, error: msg });
      }
    }
    return results;
  }

  async getPageHistory(pageId: string, limit?: number, maxItems?: number) {
    const items = await this.paginateAll("/pages/history", { pageId }, limit, maxItems);
    return items.map((entry: any) => filterHistoryEntry(entry));
  }

  async getPageHistoryDetail(historyId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/pages/history/info", {
      historyId,
    });
    const entry = response.data.data ?? response.data;
    const content = entry.content
      ? convertProseMirrorToMarkdown(entry.content)
      : "";
    return filterHistoryDetail(entry, content);
  }

  async restorePage(pageId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/pages/restore", { pageId });
    return response.data;
  }

  async getTrash(spaceId: string) {
    const pages = await this.paginateAll("/pages/trash", { spaceId });
    return pages.map((page) => filterPage(page));
  }

  async duplicatePage(pageId: string, spaceId?: string) {
    await this.ensureAuthenticated();
    const payload: Record<string, string> = { pageId };
    if (spaceId) {
      payload.spaceId = spaceId;
    }
    const response = await this.client.post("/pages/duplicate", payload);
    const newPage = response.data.data ?? response.data;
    return filterPage(newPage);
  }

  async getSpaceInfo(spaceId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/spaces/info", { spaceId });
    return filterSpace(response.data.data ?? response.data);
  }

  async createSpace(name: string, slug?: string, description?: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/spaces/create", {
      name, ...(slug && { slug }), ...(description && { description }),
    });
    return filterSpace(response.data.data ?? response.data);
  }

  async updateSpace(spaceId: string, params: Record<string, unknown>) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/spaces/update", { spaceId, ...params });
    return response.data;
  }

  async deleteSpace(spaceId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/spaces/delete", { spaceId });
    return response.data;
  }

  async exportSpace(spaceId: string, exportFormat?: string, includeAttachments?: boolean) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/spaces/export", {
      spaceId,
      ...(exportFormat && { format: exportFormat }),
      ...(includeAttachments !== undefined && { includeAttachments }),
    }, { responseType: "arraybuffer" });
    return response.data;
  }

  async getSpaceMembers(spaceId: string) {
    const members = await this.paginateAll("/spaces/members", { spaceId });
    return members;
  }

  async addSpaceMembers(spaceId: string, role: string, userIds?: string[], groupIds?: string[]) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/spaces/members/add", {
      spaceId, role, userIds: userIds ?? [], groupIds: groupIds ?? [],
    });
    return response.data;
  }

  async removeSpaceMember(spaceId: string, userId?: string, groupId?: string) {
    await this.ensureAuthenticated();
    const payload: Record<string, string> = { spaceId };
    if (userId) payload.userId = userId;
    if (groupId) payload.groupId = groupId;
    const response = await this.client.post("/spaces/members/remove", payload);
    return response.data;
  }

  async changeSpaceMemberRole(spaceId: string, role: string, userId?: string, groupId?: string) {
    await this.ensureAuthenticated();
    const payload: Record<string, string> = { spaceId, role };
    if (userId) payload.userId = userId;
    if (groupId) payload.groupId = groupId;
    const response = await this.client.post("/spaces/members/change-role", payload);
    return response.data;
  }

  async getWorkspacePublic() {
    const response = await this.client.post("/workspace/public", {});
    return response.data;
  }

  async updateWorkspace(params: Record<string, unknown>) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/workspace/update", params);
    return response.data;
  }

  async getMembers() {
    const members = await this.paginateAll("/workspace/members", {});
    return members.map((m: any) => filterMember(m));
  }

  async removeMember(userId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/workspace/members/delete", { userId });
    return response.data;
  }

  async changeMemberRole(userId: string, role: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/workspace/members/change-role", { userId, role });
    return response.data;
  }

  // Invite methods

  async getInvites() {
    const invites = await this.paginateAll("/workspace/invites", {});
    return invites.map((i: any) => filterInvite(i));
  }

  async getInviteInfo(invitationId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/workspace/invites/info", { invitationId });
    return filterInvite(response.data.data ?? response.data);
  }

  async createInvite(emails: string[], role: string, groupIds?: string[]) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/workspace/invites/create", {
      emails,
      role,
      groupIds: groupIds ?? [],
    });
    return response.data;
  }

  async revokeInvite(invitationId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/workspace/invites/revoke", { invitationId });
    return response.data;
  }

  async resendInvite(invitationId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/workspace/invites/resend", { invitationId });
    return response.data;
  }

  async getInviteLink(invitationId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/workspace/invites/link", { invitationId });
    return response.data.data ?? response.data;
  }

  // User methods

  async getCurrentUser() {
    await this.ensureAuthenticated();
    const response = await this.client.post("/users/me", {});
    return filterUser(response.data.data ?? response.data);
  }

  async updateUser(params: Record<string, unknown>) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/users/update", params);
    return response.data;
  }

  async getGroupInfo(groupId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/groups/info", { groupId });
    return filterGroup(response.data.data ?? response.data);
  }

  async createGroup(name: string, description?: string, userIds?: string[]) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/groups/create", {
      name, ...(description && { description }), ...(userIds && { userIds }),
    });
    return filterGroup(response.data.data ?? response.data);
  }

  async updateGroup(groupId: string, params: Record<string, unknown>) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/groups/update", { groupId, ...params });
    return response.data;
  }

  async deleteGroup(groupId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/groups/delete", { groupId });
    return response.data;
  }

  async getGroupMembers(groupId: string) {
    const members = await this.paginateAll("/groups/members", { groupId });
    return members;
  }

  async addGroupMembers(groupId: string, userIds: string[]) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/groups/members/add", { groupId, userIds });
    return response.data;
  }

  async removeGroupMember(groupId: string, userId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/groups/members/remove", { groupId, userId });
    return response.data;
  }

  async getPageBreadcrumbs(pageId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/pages/breadcrumbs", { pageId });
    const items = response.data.data ?? response.data;
    return Array.isArray(items)
      ? items.map((breadcrumb: any) => ({
          id: breadcrumb.id,
          title: breadcrumb.title,
        }))
      : items;
  }

  // Comment methods

  async getComments(pageId: string) {
    const comments = await this.paginateAll("/comments", { pageId });
    return comments.map((c: any) => filterComment(c));
  }

  async getCommentInfo(commentId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/comments/info", { commentId });
    return filterComment(response.data.data ?? response.data);
  }

  async createComment(pageId: string, content: string, selection?: string, parentCommentId?: string) {
    await this.ensureAuthenticated();
    const prosemirrorJson = markdownToProseMirrorJson(content);
    const response = await this.client.post("/comments/create", {
      pageId,
      content: JSON.stringify(prosemirrorJson),
      ...(selection && { selection }),
      ...(parentCommentId && { parentCommentId }),
    });
    return response.data;
  }

  async updateComment(commentId: string, content: string) {
    await this.ensureAuthenticated();
    const prosemirrorJson = markdownToProseMirrorJson(content);
    const response = await this.client.post("/comments/update", {
      commentId,
      content: JSON.stringify(prosemirrorJson),
    });
    return response.data;
  }

  async deleteComment(commentId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/comments/delete", { commentId });
    return response.data;
  }

  // Share methods

  async getShares() {
    const shares = await this.paginateAll("/shares", {});
    return shares.map((s: any) => filterShare(s));
  }

  async getShareInfo(shareId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/shares/info", { shareId });
    return filterShare(response.data.data ?? response.data);
  }

  async getShareForPage(pageId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/shares/for-page", { pageId });
    return filterShare(response.data.data ?? response.data);
  }

  async createShare(pageId: string, includeSubPages?: boolean, searchIndexing?: boolean) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/shares/create", {
      pageId,
      ...(includeSubPages !== undefined && { includeSubPages }),
      ...(searchIndexing !== undefined && { searchIndexing }),
    });
    return filterShare(response.data.data ?? response.data);
  }

  async updateShare(shareId: string, includeSubPages?: boolean, searchIndexing?: boolean) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/shares/update", {
      shareId,
      ...(includeSubPages !== undefined && { includeSubPages }),
      ...(searchIndexing !== undefined && { searchIndexing }),
    });
    return response.data;
  }

  async deleteShare(shareId: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/shares/delete", { shareId });
    return response.data;
  }

  // File methods

  async uploadFile(filePath: string, pageId: string, attachmentId?: string) {
    await this.ensureAuthenticated();
    const form = new FormData();
    form.append("file", createReadStream(filePath));
    form.append("pageId", pageId);
    if (attachmentId) form.append("attachmentId", attachmentId);
    const response = await axios.post(`${this.baseURL}/files/upload`, form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${this.token}` },
    });
    return response.data;
  }

  async downloadFile(fileId: string, fileName: string) {
    await this.ensureAuthenticated();
    const response = await this.client.get(`/files/${fileId}/${fileName}`, {
      responseType: "arraybuffer",
    });
    return response.data;
  }

  // Search suggest

  async searchSuggest(query: string, spaceId?: string, options?: {
    includeUsers?: boolean; includeGroups?: boolean; includePages?: boolean; limit?: number;
  }) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/search/suggest", {
      query, ...(spaceId && { spaceId }), ...options,
    });
    return response.data;
  }
}
