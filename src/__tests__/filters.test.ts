import { describe, it, expect } from "vitest";

import {
  filterWorkspace,
  filterSpace,
  filterGroup,
  filterPage,
  filterSearchResult,
  filterHistoryEntry,
  filterMember,
  filterInvite,
  filterUser,
  filterComment,
  filterShare,
  filterHistoryDetail,
} from "../lib/filters.js";

const extra = { __v: 9, internalField: "secret", _meta: { x: 1 } };

describe("filterWorkspace", () => {
  it("keeps expected fields and strips extras", () => {
    const input = {
      id: "w1", name: "My WS", description: "desc",
      defaultSpaceId: "s1", createdAt: "2024-01-01", updatedAt: "2024-02-01", deletedAt: null,
      ...extra,
    };
    const result = filterWorkspace(input);
    expect(result).toEqual({
      id: "w1", name: "My WS", description: "desc",
      defaultSpaceId: "s1", createdAt: "2024-01-01", updatedAt: "2024-02-01", deletedAt: null,
    });
    expect(result).not.toHaveProperty("__v");
    expect(result).not.toHaveProperty("internalField");
  });
});

describe("filterSpace", () => {
  it("keeps expected fields and strips extras", () => {
    const input = {
      id: "s1", name: "Space", description: "d", slug: "space",
      visibility: "public", createdAt: "2024-01-01", updatedAt: "2024-02-01", deletedAt: null,
      ...extra,
    };
    const result = filterSpace(input);
    expect(result).toEqual({
      id: "s1", name: "Space", description: "d", slug: "space",
      visibility: "public", createdAt: "2024-01-01", updatedAt: "2024-02-01", deletedAt: null,
    });
    expect(result).not.toHaveProperty("__v");
  });
});

describe("filterGroup", () => {
  it("keeps expected fields and strips extras", () => {
    const input = {
      id: "g1", name: "Group", description: "gd", workspaceId: "w1",
      createdAt: "2024-01-01", updatedAt: "2024-02-01", deletedAt: null,
      ...extra,
    };
    const result = filterGroup(input);
    expect(result).toEqual({
      id: "g1", name: "Group", description: "gd", workspaceId: "w1",
      createdAt: "2024-01-01", updatedAt: "2024-02-01", deletedAt: null,
    });
    expect(result).not.toHaveProperty("_meta");
  });
});

describe("filterPage", () => {
  const page = {
    id: "p1", title: "Page", parentPageId: null, spaceId: "s1",
    isLocked: false, createdAt: "2024-01-01", updatedAt: "2024-02-01", deletedAt: null,
    ...extra,
  };

  it("keeps page fields and strips extras", () => {
    const result = filterPage(page);
    expect(result).not.toHaveProperty("__v");
    expect(result.id).toBe("p1");
  });

  it("includes content when string provided", () => {
    const result = filterPage(page, "# Hello");
    expect(result.content).toBe("# Hello");
  });

  it("includes content when empty string provided", () => {
    const result = filterPage(page, "");
    expect(result.content).toBe("");
  });

  it("excludes content when undefined", () => {
    const result = filterPage(page);
    expect(result).not.toHaveProperty("content");
  });

  it("includes subpages when non-empty", () => {
    const subs = [{ id: "sp1", title: "Sub1", extra: "x" }, { id: "sp2", title: "Sub2" }];
    const result = filterPage(page, undefined, subs);
    expect(result.subpages).toEqual([{ id: "sp1", title: "Sub1" }, { id: "sp2", title: "Sub2" }]);
  });

  it("excludes subpages when empty array", () => {
    const result = filterPage(page, undefined, []);
    expect(result).not.toHaveProperty("subpages");
  });

  it("excludes subpages when undefined", () => {
    const result = filterPage(page);
    expect(result).not.toHaveProperty("subpages");
  });
});

describe("filterSearchResult", () => {
  it("maps space.id→spaceId and space.name→spaceName, keeps rank and highlight", () => {
    const input = {
      id: "p1", title: "Found", parentPageId: null,
      createdAt: "2024-01-01", updatedAt: "2024-02-01",
      rank: 0.95, highlight: "<b>found</b>",
      space: { id: "s1", name: "Main", slug: "main" },
      ...extra,
    };
    const result = filterSearchResult(input);
    expect(result.spaceId).toBe("s1");
    expect(result.spaceName).toBe("Main");
    expect(result.rank).toBe(0.95);
    expect(result.highlight).toBe("<b>found</b>");
    expect(result).not.toHaveProperty("space");
    expect(result).not.toHaveProperty("__v");
  });
});

describe("filterHistoryEntry", () => {
  it("maps lastUpdatedBy.name", () => {
    const input = {
      id: "h1", pageId: "p1", title: "V2", version: 2,
      createdAt: "2024-01-01",
      lastUpdatedBy: { id: "u1", name: "Alice" },
      lastUpdatedById: "u1",
      contributors: [{ name: "Alice" }, { name: "Bob" }],
      ...extra,
    };
    const result = filterHistoryEntry(input);
    expect(result.lastUpdatedBy).toBe("Alice");
    expect(result.contributors).toEqual(["Alice", "Bob"]);
    expect(result).not.toHaveProperty("__v");
  });

  it("falls back to lastUpdatedById when lastUpdatedBy is missing", () => {
    const input = {
      id: "h2", pageId: "p1", title: "V1", version: 1,
      createdAt: "2024-01-01",
      lastUpdatedById: "u99",
      contributors: [],
    };
    const result = filterHistoryEntry(input);
    expect(result.lastUpdatedBy).toBe("u99");
  });

  it("returns empty array when contributors missing", () => {
    const input = {
      id: "h3", pageId: "p1", title: "V0", version: 0,
      createdAt: "2024-01-01",
      lastUpdatedById: "u1",
    };
    const result = filterHistoryEntry(input);
    expect(result.contributors).toEqual([]);
  });
});

describe("filterMember", () => {
  it("keeps expected fields and strips extras", () => {
    const input = {
      id: "m1", name: "Alice", email: "a@b.com", role: "admin",
      createdAt: "2024-01-01", ...extra,
    };
    const result = filterMember(input);
    expect(result).toEqual({
      id: "m1", name: "Alice", email: "a@b.com", role: "admin", createdAt: "2024-01-01",
    });
    expect(result).not.toHaveProperty("internalField");
  });
});

describe("filterInvite", () => {
  it("keeps expected fields and strips extras", () => {
    const input = {
      id: "i1", email: "x@y.com", role: "editor", status: "pending",
      invitedById: "u1", createdAt: "2024-01-01", ...extra,
    };
    const result = filterInvite(input);
    expect(result).toEqual({
      id: "i1", email: "x@y.com", role: "editor", status: "pending",
      invitedById: "u1", createdAt: "2024-01-01",
    });
    expect(result).not.toHaveProperty("__v");
  });
});

describe("filterUser", () => {
  it("keeps expected fields and strips extras", () => {
    const input = {
      id: "u1", name: "Bob", email: "b@b.com", role: "owner",
      locale: "en", createdAt: "2024-01-01", ...extra,
    };
    const result = filterUser(input);
    expect(result).toEqual({
      id: "u1", name: "Bob", email: "b@b.com", role: "owner",
      locale: "en", createdAt: "2024-01-01",
    });
    expect(result).not.toHaveProperty("_meta");
  });
});

describe("filterComment", () => {
  it("keeps all comment fields and strips extras", () => {
    const input = {
      id: "c1", pageId: "p1", content: "Nice!", selection: "text",
      parentCommentId: null, creatorId: "u1",
      createdAt: "2024-01-01", updatedAt: "2024-02-01",
      ...extra,
    };
    const result = filterComment(input);
    expect(result).toEqual({
      id: "c1", pageId: "p1", content: "Nice!", selection: "text",
      parentCommentId: null, creatorId: "u1",
      createdAt: "2024-01-01", updatedAt: "2024-02-01",
    });
    expect(result).not.toHaveProperty("__v");
  });
});

describe("filterShare", () => {
  it("keeps expected fields and strips extras", () => {
    const input = {
      id: "sh1", pageId: "p1", includeSubPages: true,
      searchIndexing: false, createdAt: "2024-01-01", ...extra,
    };
    const result = filterShare(input);
    expect(result).toEqual({
      id: "sh1", pageId: "p1", includeSubPages: true,
      searchIndexing: false, createdAt: "2024-01-01",
    });
    expect(result).not.toHaveProperty("internalField");
  });
});

describe("filterHistoryDetail", () => {
  const entry = {
    id: "h1", pageId: "p1", title: "V3", version: 3,
    createdAt: "2024-01-01",
    lastUpdatedBy: { name: "Carol" },
    contributors: [{ name: "Carol" }],
    ...extra,
  };

  it("extends filterHistoryEntry with content", () => {
    const result = filterHistoryDetail(entry, "# Content");
    expect(result.content).toBe("# Content");
    expect(result.id).toBe("h1");
    expect(result.lastUpdatedBy).toBe("Carol");
    expect(result).not.toHaveProperty("__v");
  });

  it("includes content when empty string", () => {
    const result = filterHistoryDetail(entry, "");
    expect(result.content).toBe("");
  });

  it("excludes content when undefined", () => {
    const result = filterHistoryDetail(entry);
    expect(result).not.toHaveProperty("content");
  });
});
