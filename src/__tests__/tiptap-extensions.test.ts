import { describe, it, expect } from "vitest";
import { generateJSON } from "@tiptap/html";
import { tiptapExtensions } from "../lib/tiptap-extensions.js";

const parse = (html: string) => generateJSON(html, tiptapExtensions);

describe("tiptapExtensions with generateJSON", () => {
  it("parses basic paragraph", () => {
    const doc = parse("<p>hello world</p>");
    expect(doc.type).toBe("doc");
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].type).toBe("paragraph");
    expect(doc.content[0].content[0].text).toBe("hello world");
  });

  it("parses h1 heading", () => {
    const doc = parse("<h1>Title</h1>");
    const heading = doc.content[0];
    expect(heading.type).toBe("heading");
    expect(heading.attrs.level).toBe(1);
    expect(heading.content[0].text).toBe("Title");
  });

  it("parses h2 heading", () => {
    const doc = parse("<h2>Subtitle</h2>");
    const heading = doc.content[0];
    expect(heading.type).toBe("heading");
    expect(heading.attrs.level).toBe(2);
  });

  it("parses bold text", () => {
    const doc = parse("<p><strong>bold</strong></p>");
    const textNode = doc.content[0].content[0];
    expect(textNode.text).toBe("bold");
    expect(textNode.marks).toEqual(expect.arrayContaining([expect.objectContaining({ type: "bold" })]));
  });

  it("parses italic text", () => {
    const doc = parse("<p><em>italic</em></p>");
    const textNode = doc.content[0].content[0];
    expect(textNode.text).toBe("italic");
    expect(textNode.marks).toEqual(expect.arrayContaining([expect.objectContaining({ type: "italic" })]));
  });

  it("parses link", () => {
    const doc = parse('<p><a href="https://example.com">click</a></p>');
    const textNode = doc.content[0].content[0];
    expect(textNode.text).toBe("click");
    const linkMark = textNode.marks.find((m: any) => m.type === "link");
    expect(linkMark).toBeDefined();
    expect(linkMark.attrs.href).toBe("https://example.com");
  });

  it("parses image", () => {
    const doc = parse('<p><img src="https://example.com/img.png" alt="photo"></p>');
    const img = doc.content[0].content.find((n: any) => n.type === "image");
    expect(img).toBeDefined();
    expect(img.attrs.src).toBe("https://example.com/img.png");
    expect(img.attrs.alt).toBe("photo");
  });

  it("parses code block with language", () => {
    const doc = parse('<pre><code class="language-js">const x = 1;</code></pre>');
    const codeBlock = doc.content[0];
    expect(codeBlock.type).toBe("codeBlock");
    expect(codeBlock.attrs.language).toBe("js");
    expect(codeBlock.content[0].text).toBe("const x = 1;");
  });

  it("parses bullet list", () => {
    const doc = parse("<ul><li>a</li><li>b</li></ul>");
    const list = doc.content[0];
    expect(list.type).toBe("bulletList");
    expect(list.content).toHaveLength(2);
    expect(list.content[0].type).toBe("listItem");
  });

  it("parses ordered list", () => {
    const doc = parse("<ol><li>first</li><li>second</li></ol>");
    const list = doc.content[0];
    expect(list.type).toBe("orderedList");
    expect(list.content).toHaveLength(2);
    expect(list.content[0].type).toBe("listItem");
  });

  describe("tables", () => {
    it("parses table with headers", () => {
      const html = "<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>";
      const doc = parse(html);
      const table = doc.content[0];
      expect(table.type).toBe("table");
      expect(table.content).toHaveLength(2);

      const headerRow = table.content[0];
      expect(headerRow.type).toBe("tableRow");
      expect(headerRow.content[0].type).toBe("tableHeader");
      expect(headerRow.content[1].type).toBe("tableHeader");

      const dataRow = table.content[1];
      expect(dataRow.type).toBe("tableRow");
      expect(dataRow.content[0].type).toBe("tableCell");
      expect(dataRow.content[1].type).toBe("tableCell");

      // Verify cell content
      const cellText = dataRow.content[0].content[0].content[0].text;
      expect(cellText).toBe("1");
    });

    it("parses table without headers (all td)", () => {
      const html = "<table><tr><td>x</td><td>y</td></tr><tr><td>z</td><td>w</td></tr></table>";
      const doc = parse(html);
      const table = doc.content[0];
      expect(table.type).toBe("table");
      expect(table.content).toHaveLength(2);

      for (const row of table.content) {
        expect(row.type).toBe("tableRow");
        for (const cell of row.content) {
          expect(cell.type).toBe("tableCell");
        }
      }
    });

    it("parses table with multiple rows", () => {
      const html =
        "<table>" +
        "<tr><th>Name</th><th>Value</th></tr>" +
        "<tr><td>a</td><td>1</td></tr>" +
        "<tr><td>b</td><td>2</td></tr>" +
        "<tr><td>c</td><td>3</td></tr>" +
        "</table>";
      const doc = parse(html);
      const table = doc.content[0];
      expect(table.type).toBe("table");
      expect(table.content).toHaveLength(4); // 1 header + 3 data rows
    });
  });
});
