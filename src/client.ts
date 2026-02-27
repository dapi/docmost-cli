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
} from "./lib/filters.js";
import { convertProseMirrorToMarkdown } from "./lib/markdown-converter.js";
import { updatePageContentRealtime } from "./lib/collaboration.js";
import { getCollabToken, performLogin } from "./lib/auth-utils.js";

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
  ): Promise<T[]> {
    await this.ensureAuthenticated();

    const clampedLimit = Math.max(1, Math.min(100, limit));

    let page = 1;
    let allItems: T[] = [];
    let hasNextPage = true;

    while (hasNextPage) {
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

    return allItems;
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

  async createPage(
    title: string,
    content: string,
    spaceId: string,
    parentPageId?: string,
  ) {
    await this.ensureAuthenticated();

    if (parentPageId) {
      try {
        await this.getPage(parentPageId);
      } catch {
        throw new Error(`Parent page with ID '${parentPageId}' not found or not accessible.`);
      }
    }

    const form = new FormData();
    form.append("spaceId", spaceId);

    const fileContent = Buffer.from(content, "utf-8");
    form.append("file", fileContent, {
      filename: `${title || "import"}.md`,
      contentType: "text/markdown",
    });

    const headers = {
      ...form.getHeaders(),
      Authorization: `Bearer ${this.token}`,
    };

    const response = await axios.post(`${this.baseURL}/pages/import`, form, {
      headers,
    });
    const newPageId = response.data.data.id;

    if (title) {
      await this.client.post("/pages/update", { pageId: newPageId, title });
    }

    if (parentPageId) {
      await this.movePage(newPageId, parentPageId);
    }

    return this.getPage(newPageId);
  }

  async updatePage(pageId: string, content: string, title?: string) {
    await this.ensureAuthenticated();

    if (title !== undefined) {
      await this.client.post("/pages/update", { pageId, title });
    }

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

    return {
      success: true,
      modified: true,
      message: "Page updated successfully.",
      pageId,
    };
  }

  async search(query: string, spaceId?: string) {
    await this.ensureAuthenticated();
    const response = await this.client.post("/search", {
      query,
      spaceId,
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

  async getPageHistory(pageId: string, cursor?: string) {
    await this.ensureAuthenticated();
    const payload: Record<string, string> = { pageId };
    if (cursor) {
      payload.cursor = cursor;
    }

    const response = await this.client.post("/pages/history", payload);
    const data = response.data.data ?? response.data;
    const items = data.items ?? [];
    return {
      items: items.map((entry: any) => filterHistoryEntry(entry)),
      cursor: data.cursor || null,
    };
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
}
