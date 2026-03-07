import { describe, it, expect } from "vitest";
import { convertProseMirrorToMarkdown } from "../lib/markdown-converter.js";

// Helper to build a minimal doc with given content nodes
const doc = (...nodes: any[]) => ({ type: "doc", content: nodes });
const p = (...children: any[]) => ({ type: "paragraph", content: children });
const txt = (text: string, marks?: any[]) => ({ type: "text", text, ...(marks ? { marks } : {}) });

describe("convertProseMirrorToMarkdown", () => {
  // ── Edge cases ──────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("returns empty string for null input", () => {
      expect(convertProseMirrorToMarkdown(null)).toBe("");
    });

    it("returns empty string for undefined input", () => {
      expect(convertProseMirrorToMarkdown(undefined)).toBe("");
    });

    it("returns empty string for object without content", () => {
      expect(convertProseMirrorToMarkdown({ type: "doc" })).toBe("");
    });

    it("returns empty string for empty content array", () => {
      expect(convertProseMirrorToMarkdown({ type: "doc", content: [] })).toBe("");
    });

    it("returns empty string for paragraph with no children", () => {
      expect(convertProseMirrorToMarkdown(doc({ type: "paragraph" }))).toBe("");
    });
  });

  // ── Basic nodes ─────────────────────────────────────────────────────

  describe("paragraph", () => {
    it("renders plain text", () => {
      expect(convertProseMirrorToMarkdown(doc(p(txt("Hello world"))))).toBe("Hello world");
    });

    it("renders multiple paragraphs separated by blank lines", () => {
      const result = convertProseMirrorToMarkdown(doc(p(txt("First")), p(txt("Second"))));
      expect(result).toBe("First\n\nSecond");
    });

    it("renders textAlign as div", () => {
      const node = { type: "paragraph", attrs: { textAlign: "center" }, content: [txt("Centered")] };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe('<div align="center">Centered</div>');
    });

    it("ignores textAlign=left", () => {
      const node = { type: "paragraph", attrs: { textAlign: "left" }, content: [txt("Normal")] };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("Normal");
    });
  });

  describe("heading", () => {
    for (let level = 1; level <= 6; level++) {
      it(`renders h${level}`, () => {
        const node = { type: "heading", attrs: { level }, content: [txt(`Heading ${level}`)] };
        expect(convertProseMirrorToMarkdown(doc(node))).toBe(`${"#".repeat(level)} Heading ${level}`);
      });
    }

    it("defaults to level 1 when no attrs", () => {
      const node = { type: "heading", content: [txt("Default")] };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("# Default");
    });
  });

  describe("hardBreak", () => {
    it("renders as newline", () => {
      const result = convertProseMirrorToMarkdown(doc(p(txt("Line 1"), { type: "hardBreak" }, txt("Line 2"))));
      expect(result).toBe("Line 1\nLine 2");
    });
  });

  describe("horizontalRule", () => {
    it("renders as ---", () => {
      expect(convertProseMirrorToMarkdown(doc({ type: "horizontalRule" }))).toBe("---");
    });
  });

  // ── Text marks ──────────────────────────────────────────────────────

  describe("text marks", () => {
    it("bold", () => {
      expect(convertProseMirrorToMarkdown(doc(p(txt("bold", [{ type: "bold" }]))))).toBe("**bold**");
    });

    it("italic", () => {
      expect(convertProseMirrorToMarkdown(doc(p(txt("italic", [{ type: "italic" }]))))).toBe("*italic*");
    });

    it("code", () => {
      expect(convertProseMirrorToMarkdown(doc(p(txt("code", [{ type: "code" }]))))).toBe("`code`");
    });

    it("strike", () => {
      expect(convertProseMirrorToMarkdown(doc(p(txt("struck", [{ type: "strike" }]))))).toBe("~~struck~~");
    });

    it("underline", () => {
      expect(convertProseMirrorToMarkdown(doc(p(txt("underlined", [{ type: "underline" }]))))).toBe("<u>underlined</u>");
    });

    it("subscript", () => {
      expect(convertProseMirrorToMarkdown(doc(p(txt("sub", [{ type: "subscript" }]))))).toBe("<sub>sub</sub>");
    });

    it("superscript", () => {
      expect(convertProseMirrorToMarkdown(doc(p(txt("sup", [{ type: "superscript" }]))))).toBe("<sup>sup</sup>");
    });

    it("link", () => {
      const mark = { type: "link", attrs: { href: "https://example.com" } };
      expect(convertProseMirrorToMarkdown(doc(p(txt("click", [mark]))))).toBe("[click](https://example.com)");
    });

    it("link with no href", () => {
      const mark = { type: "link", attrs: {} };
      expect(convertProseMirrorToMarkdown(doc(p(txt("click", [mark]))))).toBe("[click]()");
    });

    it("highlight with default color", () => {
      const mark = { type: "highlight" };
      expect(convertProseMirrorToMarkdown(doc(p(txt("hi", [mark]))))).toBe(
        '<mark style="background-color: yellow">hi</mark>',
      );
    });

    it("highlight with custom color", () => {
      const mark = { type: "highlight", attrs: { color: "red" } };
      expect(convertProseMirrorToMarkdown(doc(p(txt("hi", [mark]))))).toBe(
        '<mark style="background-color: red">hi</mark>',
      );
    });

    it("textStyle with color", () => {
      const mark = { type: "textStyle", attrs: { color: "#ff0000" } };
      expect(convertProseMirrorToMarkdown(doc(p(txt("colored", [mark]))))).toBe(
        '<span style="color: #ff0000">colored</span>',
      );
    });

    it("textStyle without color does not wrap", () => {
      const mark = { type: "textStyle", attrs: {} };
      expect(convertProseMirrorToMarkdown(doc(p(txt("plain", [mark]))))).toBe("plain");
    });

    it("nested marks: bold+italic", () => {
      const marks = [{ type: "bold" }, { type: "italic" }];
      expect(convertProseMirrorToMarkdown(doc(p(txt("both", marks))))).toBe("***both***");
    });

    it("nested marks: bold+link", () => {
      const marks = [{ type: "bold" }, { type: "link", attrs: { href: "https://x.com" } }];
      expect(convertProseMirrorToMarkdown(doc(p(txt("link", marks))))).toBe("[**link**](https://x.com)");
    });
  });

  // ── Lists ───────────────────────────────────────────────────────────

  describe("bulletList", () => {
    it("renders items with dashes", () => {
      const list = {
        type: "bulletList",
        content: [
          { type: "listItem", content: [p(txt("Item 1"))] },
          { type: "listItem", content: [p(txt("Item 2"))] },
        ],
      };
      expect(convertProseMirrorToMarkdown(doc(list))).toBe("- Item 1\n- Item 2");
    });
  });

  describe("orderedList", () => {
    it("renders items with numbers", () => {
      const list = {
        type: "orderedList",
        content: [
          { type: "listItem", content: [p(txt("First"))] },
          { type: "listItem", content: [p(txt("Second"))] },
        ],
      };
      expect(convertProseMirrorToMarkdown(doc(list))).toBe("1. First\n2. Second");
    });
  });

  describe("taskList", () => {
    it("renders unchecked items", () => {
      const list = {
        type: "taskList",
        content: [
          { type: "taskItem", attrs: { checked: false }, content: [p(txt("Todo"))] },
        ],
      };
      expect(convertProseMirrorToMarkdown(doc(list))).toBe("- [ ] Todo");
    });

    it("renders checked items", () => {
      const list = {
        type: "taskList",
        content: [
          { type: "taskItem", attrs: { checked: true }, content: [p(txt("Done"))] },
        ],
      };
      expect(convertProseMirrorToMarkdown(doc(list))).toBe("- [x] Done");
    });

    it("renders mixed checked/unchecked", () => {
      const list = {
        type: "taskList",
        content: [
          { type: "taskItem", attrs: { checked: true }, content: [p(txt("Done"))] },
          { type: "taskItem", attrs: { checked: false }, content: [p(txt("Pending"))] },
        ],
      };
      expect(convertProseMirrorToMarkdown(doc(list))).toBe("- [x] Done\n- [ ] Pending");
    });
  });

  // ── Code blocks ─────────────────────────────────────────────────────

  describe("codeBlock", () => {
    it("renders without language", () => {
      const node = { type: "codeBlock", content: [txt("const x = 1;")] };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("```\nconst x = 1;\n```");
    });

    it("renders with language", () => {
      const node = { type: "codeBlock", attrs: { language: "typescript" }, content: [txt("const x: number = 1;")] };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("```typescript\nconst x: number = 1;\n```");
    });

    it("renders empty code block", () => {
      const node = { type: "codeBlock" };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("```\n\n```");
    });
  });

  // ── Blockquote ──────────────────────────────────────────────────────

  describe("blockquote", () => {
    it("renders single paragraph", () => {
      const node = { type: "blockquote", content: [p(txt("Quote"))] };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("> Quote");
    });

    it("renders multi-paragraph", () => {
      const node = { type: "blockquote", content: [p(txt("Line 1")), p(txt("Line 2"))] };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("> Line 1\n> Line 2");
    });
  });

  // ── Images ──────────────────────────────────────────────────────────

  describe("image", () => {
    it("renders with alt text", () => {
      const node = { type: "image", attrs: { alt: "Photo", src: "https://img.com/a.png" } };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("![Photo](https://img.com/a.png)");
    });

    it("renders without alt text", () => {
      const node = { type: "image", attrs: { src: "https://img.com/a.png" } };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("![](https://img.com/a.png)");
    });

    it("renders with caption", () => {
      const node = { type: "image", attrs: { alt: "Photo", src: "https://img.com/a.png", caption: "A nice photo" } };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("![Photo](https://img.com/a.png)\n*A nice photo*");
    });

    it("renders with empty caption (no caption line)", () => {
      const node = { type: "image", attrs: { alt: "Photo", src: "https://img.com/a.png", caption: "" } };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("![Photo](https://img.com/a.png)");
    });
  });

  // ── Tables ──────────────────────────────────────────────────────────

  describe("table", () => {
    it("renders header + body row", () => {
      const table = {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              { type: "tableHeader", content: [p(txt("Name"))] },
              { type: "tableHeader", content: [p(txt("Age"))] },
            ],
          },
          {
            type: "tableRow",
            content: [
              { type: "tableCell", content: [p(txt("Alice"))] },
              { type: "tableCell", content: [p(txt("30"))] },
            ],
          },
        ],
      };
      const result = convertProseMirrorToMarkdown(doc(table));
      expect(result).toBe("| Name | Age |\n| --- | --- |\n| Alice | 30 |");
    });

    it("renders multiple body rows", () => {
      const table = {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              { type: "tableHeader", content: [p(txt("Col"))] },
            ],
          },
          {
            type: "tableRow",
            content: [{ type: "tableCell", content: [p(txt("A"))] }],
          },
          {
            type: "tableRow",
            content: [{ type: "tableCell", content: [p(txt("B"))] }],
          },
        ],
      };
      const result = convertProseMirrorToMarkdown(doc(table));
      expect(result).toBe("| Col |\n| --- |\n| A |\n| B |");
    });

    it("renders table with no explicit headers (all cells)", () => {
      const table = {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              { type: "tableCell", content: [p(txt("A"))] },
              { type: "tableCell", content: [p(txt("B"))] },
            ],
          },
          {
            type: "tableRow",
            content: [
              { type: "tableCell", content: [p(txt("C"))] },
              { type: "tableCell", content: [p(txt("D"))] },
            ],
          },
        ],
      };
      const result = convertProseMirrorToMarkdown(doc(table));
      // First row treated as header, separator inserted after
      expect(result).toBe("| A | B |\n| --- | --- |\n| C | D |");
    });
  });

  // ── Special nodes ───────────────────────────────────────────────────

  describe("callout", () => {
    it("renders with type", () => {
      const node = { type: "callout", attrs: { type: "warning" }, content: [p(txt("Be careful"))] };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe(":::warning\nBe careful\n:::");
    });

    it("defaults to info type", () => {
      const node = { type: "callout", content: [p(txt("Note"))] };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe(":::info\nNote\n:::");
    });

    it("lowercases the type", () => {
      const node = { type: "callout", attrs: { type: "WARNING" }, content: [p(txt("Caution"))] };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe(":::warning\nCaution\n:::");
    });
  });

  describe("details", () => {
    it("renders details with summary and content", () => {
      const node = {
        type: "details",
        content: [
          { type: "detailsSummary", content: [txt("Click me")] },
          { type: "detailsContent", content: [p(txt("Hidden content"))] },
        ],
      };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe(
        "<details>\n<summary>Click me</summary>\n\nHidden content\n</details>",
      );
    });
  });

  describe("mathInline", () => {
    it("renders inline math", () => {
      const node = { type: "mathInline", attrs: { text: "E = mc^2" } };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("$E = mc^2$");
    });

    it("renders empty inline math", () => {
      const node = { type: "mathInline", attrs: {} };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("$$");
    });
  });

  describe("mathBlock", () => {
    it("renders block math", () => {
      const node = { type: "mathBlock", attrs: { text: "\\sum_{i=1}^n x_i" } };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("$$\n\\sum_{i=1}^n x_i\n$$");
    });
  });

  describe("mention", () => {
    it("renders with label", () => {
      const node = { type: "mention", attrs: { label: "John" } };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("@John");
    });

    it("falls back to id", () => {
      const node = { type: "mention", attrs: { id: "user-123" } };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("@user-123");
    });

    it("renders empty when no label or id", () => {
      const node = { type: "mention", attrs: {} };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("@");
    });
  });

  describe("attachment", () => {
    it("renders with filename and url", () => {
      const node = { type: "attachment", attrs: { fileName: "doc.pdf", src: "https://files.com/doc.pdf" } };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("\u{1F4CE} [doc.pdf](https://files.com/doc.pdf)");
    });

    it("defaults filename to attachment", () => {
      const node = { type: "attachment", attrs: { src: "https://files.com/x" } };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("\u{1F4CE} [attachment](https://files.com/x)");
    });
  });

  describe("drawio", () => {
    it("renders placeholder", () => {
      expect(convertProseMirrorToMarkdown(doc({ type: "drawio" }))).toBe("\u{1F4CA} [Draw.io Diagram]");
    });
  });

  describe("excalidraw", () => {
    it("renders placeholder", () => {
      expect(convertProseMirrorToMarkdown(doc({ type: "excalidraw" }))).toBe("\u270F\uFE0F [Excalidraw Drawing]");
    });
  });

  describe("embed", () => {
    it("renders with url", () => {
      const node = { type: "embed", attrs: { src: "https://example.com/embed" } };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("\u{1F517} [Embedded Content](https://example.com/embed)");
    });
  });

  describe("youtube", () => {
    it("renders with url", () => {
      const node = { type: "youtube", attrs: { src: "https://youtube.com/watch?v=abc" } };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("\u{1F4FA} [YouTube Video](https://youtube.com/watch?v=abc)");
    });
  });

  describe("video", () => {
    it("renders with url", () => {
      const node = { type: "video", attrs: { src: "https://cdn.com/video.mp4" } };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("\u{1F3A5} [Video](https://cdn.com/video.mp4)");
    });
  });

  describe("subpages", () => {
    it("renders placeholder", () => {
      expect(convertProseMirrorToMarkdown(doc({ type: "subpages" }))).toBe("{{SUBPAGES}}");
    });
  });

  // ── Security: sanitizeUrl ───────────────────────────────────────────

  describe("sanitizeUrl", () => {
    it("strips javascript: from link href", () => {
      const mark = { type: "link", attrs: { href: "javascript:alert(1)" } };
      expect(convertProseMirrorToMarkdown(doc(p(txt("xss", [mark]))))).toBe("[xss]()");
    });

    it("strips JavaScript: (case insensitive)", () => {
      const mark = { type: "link", attrs: { href: "JavaScript:void(0)" } };
      expect(convertProseMirrorToMarkdown(doc(p(txt("xss", [mark]))))).toBe("[xss]()");
    });

    it("strips data: from image src", () => {
      const node = { type: "image", attrs: { alt: "x", src: "data:text/html,<h1>hi</h1>" } };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("![x]()");
    });

    it("strips vbscript: URLs", () => {
      const mark = { type: "link", attrs: { href: "vbscript:MsgBox" } };
      expect(convertProseMirrorToMarkdown(doc(p(txt("xss", [mark]))))).toBe("[xss]()");
    });

    it("strips data: from video src", () => {
      const node = { type: "video", attrs: { src: "data:video/mp4;base64,AAAA" } };
      expect(convertProseMirrorToMarkdown(doc(node))).toBe("\u{1F3A5} [Video]()");
    });

    it("strips javascript: with leading whitespace", () => {
      const mark = { type: "link", attrs: { href: "  javascript:alert(1)" } };
      expect(convertProseMirrorToMarkdown(doc(p(txt("xss", [mark]))))).toBe("[xss]()");
    });

    it("allows https: URLs", () => {
      const mark = { type: "link", attrs: { href: "https://safe.com" } };
      expect(convertProseMirrorToMarkdown(doc(p(txt("ok", [mark]))))).toBe("[ok](https://safe.com)");
    });

    it("allows mailto: URLs", () => {
      const mark = { type: "link", attrs: { href: "mailto:user@example.com" } };
      expect(convertProseMirrorToMarkdown(doc(p(txt("email", [mark]))))).toBe("[email](mailto:user@example.com)");
    });
  });

  // ── HTML attribute escaping ─────────────────────────────────────────

  describe("escapeHtmlAttr", () => {
    it("escapes special chars in textAlign", () => {
      const node = { type: "paragraph", attrs: { textAlign: 'center"><script>' }, content: [txt("XSS")] };
      const result = convertProseMirrorToMarkdown(doc(node));
      expect(result).toBe('<div align="center&quot;&gt;&lt;script&gt;">XSS</div>');
    });

    it("escapes special chars in highlight color", () => {
      const mark = { type: "highlight", attrs: { color: '"><img onerror=alert(1) src=x>' } };
      const result = convertProseMirrorToMarkdown(doc(p(txt("hi", [mark]))));
      expect(result).toContain("&quot;&gt;&lt;img");
      expect(result).not.toContain('"><img');
    });
  });
});
