/**
 * Convert ProseMirror/TipTap JSON content to Markdown
 * Supports all Docmost-specific node types and extensions
 */
function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^javascript:/i.test(trimmed) || /^data:/i.test(trimmed) || /^vbscript:/i.test(trimmed)) {
    return "";
  }
  return trimmed;
}

export function convertProseMirrorToMarkdown(content: any): string {
  if (!content || !content.content) return "";

  const processNode = (node: any): string => {
    const type = node.type;
    const nodeContent = node.content || [];

    switch (type) {
      case "doc":
        return nodeContent.map(processNode).join("\n\n");

      case "paragraph":
        const text = nodeContent.map(processNode).join("");
        const align = node.attrs?.textAlign;
        if (align && align !== "left") {
          return `<div align="${escapeHtmlAttr(align)}">${text}</div>`;
        }
        return text || "";

      case "heading":
        const level = node.attrs?.level || 1;
        const headingText = nodeContent.map(processNode).join("");
        return "#".repeat(level) + " " + headingText;

      case "text":
        let textContent = node.text || "";
        // Apply marks (bold, italic, code, etc.)
        if (node.marks) {
          for (const mark of node.marks) {
            switch (mark.type) {
              case "bold":
                textContent = `**${textContent}**`;
                break;
              case "italic":
                textContent = `*${textContent}*`;
                break;
              case "code":
                textContent = `\`${textContent}\``;
                break;
              case "link":
                textContent = `[${textContent}](${sanitizeUrl(mark.attrs?.href || "")})`;
                break;
              case "strike":
                textContent = `~~${textContent}~~`;
                break;
              case "underline":
                textContent = `<u>${textContent}</u>`;
                break;
              case "subscript":
                textContent = `<sub>${textContent}</sub>`;
                break;
              case "superscript":
                textContent = `<sup>${textContent}</sup>`;
                break;
              case "highlight":
                const color = mark.attrs?.color || "yellow";
                textContent = `<mark style="background-color: ${escapeHtmlAttr(color)}">${textContent}</mark>`;
                break;
              case "textStyle":
                if (mark.attrs?.color) {
                  textContent = `<span style="color: ${escapeHtmlAttr(mark.attrs.color)}">${textContent}</span>`;
                }
                break;
            }
          }
        }
        return textContent;

      case "codeBlock":
        const language = node.attrs?.language || "";
        const code = nodeContent.map(processNode).join("");
        return "```" + language + "\n" + code + "\n```";

      case "bulletList":
        return nodeContent
          .map((item: any) => processListItem(item, "-"))
          .join("\n");

      case "orderedList":
        return nodeContent
          .map((item: any, index: number) =>
            processListItem(item, `${index + 1}.`),
          )
          .join("\n");

      case "taskList":
        return nodeContent.map((item: any) => processTaskItem(item)).join("\n");

      case "taskItem":
        const checked = node.attrs?.checked || false;
        const checkbox = checked ? "[x]" : "[ ]";
        return `- ${checkbox} ${nodeContent.map(processNode).join("\n")}`;

      case "listItem":
        return nodeContent.map(processNode).join("\n");

      case "blockquote":
        return nodeContent.map((n: any) => "> " + processNode(n)).join("\n");

      case "horizontalRule":
        return "---";

      case "hardBreak":
        return "\n";

      case "image":
        const imgAlt = node.attrs?.alt || "";
        const imgSrc = sanitizeUrl(node.attrs?.src || "");
        const imgCaption = node.attrs?.caption || "";
        return `![${imgAlt}](${imgSrc})${imgCaption ? `\n*${imgCaption}*` : ""}`;

      case "video":
        const videoSrc = sanitizeUrl(node.attrs?.src || "");
        return `🎥 [Video](${videoSrc})`;

      case "youtube":
        const youtubeUrl = sanitizeUrl(node.attrs?.src || "");
        return `📺 [YouTube Video](${youtubeUrl})`;

      case "table":
        return nodeContent.map(processNode).join("\n");

      case "tableRow":
        return "| " + nodeContent.map(processNode).join(" | ") + " |";

      case "tableCell":
      case "tableHeader":
        return nodeContent.map(processNode).join("");

      case "callout":
        const calloutType = node.attrs?.type || "info";
        const calloutContent = nodeContent.map(processNode).join("\n");
        return `:::${calloutType.toLowerCase()}\n${calloutContent}\n:::`;

      case "details":
        return nodeContent.map(processNode).join("\n");

      case "detailsSummary":
        const summaryText = nodeContent.map(processNode).join("");
        return `<details>\n<summary>${summaryText}</summary>\n`;

      case "detailsContent":
        const detailsText = nodeContent.map(processNode).join("\n");
        return `${detailsText}\n</details>`;

      case "mathInline":
        const inlineMath = node.attrs?.text || "";
        return `$${inlineMath}$`;

      case "mathBlock":
        const blockMath = node.attrs?.text || "";
        return `$$\n${blockMath}\n$$`;

      case "mention":
        const mentionLabel = node.attrs?.label || node.attrs?.id || "";
        return `@${mentionLabel}`;

      case "attachment":
        const attachmentName = node.attrs?.fileName || "attachment";
        const attachmentUrl = sanitizeUrl(node.attrs?.src || "");
        return `📎 [${attachmentName}](${attachmentUrl})`;

      case "drawio":
        return `📊 [Draw.io Diagram]`;

      case "excalidraw":
        return `✏️ [Excalidraw Drawing]`;

      case "embed":
        const embedUrl = sanitizeUrl(node.attrs?.src || "");
        return `🔗 [Embedded Content](${embedUrl})`;

      case "subpages":
        return "{{SUBPAGES}}";

      default:
        process.stderr.write(`Warning: unknown node type '${type}', rendering as plain text.\n`);
        return nodeContent.map(processNode).join("");
    }
  };

  const processListItem = (item: any, prefix: string): string => {
    const itemContent = item.content || [];
    const lines = itemContent.map(processNode);
    return lines
      .map((line: string, i: number) =>
        i === 0 ? `${prefix} ${line}` : `  ${line}`,
      )
      .join("\n");
  };

  const processTaskItem = (item: any): string => {
    const checked = item.attrs?.checked || false;
    const checkbox = checked ? "[x]" : "[ ]";
    const itemContent = item.content || [];
    const text = itemContent.map(processNode).join("");
    return `- ${checkbox} ${text}`;
  };

  return processNode(content).trim();
}
