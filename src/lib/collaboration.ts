import { HocuspocusProvider } from "@hocuspocus/provider";
import { TiptapTransformer } from "@hocuspocus/transformer";
import * as Y from "yjs";
import WebSocket from "ws";
import { marked } from "marked";
import { generateJSON } from "@tiptap/html";
import { JSDOM } from "jsdom";
import { tiptapExtensions } from "./tiptap-extensions.js";

function setupDomEnvironment() {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  global.window = dom.window as any;
  global.document = dom.window.document;
  // @ts-ignore
  global.Element = dom.window.Element;
  // @ts-ignore
  global.WebSocket = WebSocket;
}

export async function updatePageContentRealtime(
  pageId: string,
  markdownContent: string,
  collabToken: string,
  baseUrl: string,
): Promise<void> {
  setupDomEnvironment();
  console.error(`Starting realtime update for page ${pageId}`);
  console.error(`Collab token: ${collabToken ? "present" : "missing"}`);

  // 1. Convert Markdown to HTML
  const html = await marked.parse(markdownContent);

  // 2. Convert HTML to ProseMirror JSON
  const tiptapJson = generateJSON(html, tiptapExtensions);

  // 3. Setup Hocuspocus Provider
  const ydoc = new Y.Doc();

  // Construct WebSocket URL
  // Replace protocol
  let wsUrl = baseUrl.replace(/^http/, "ws");

  const urlObj = new URL(wsUrl);
  // Remove /api suffix if present, as the websocket is mounted on root /collab
  if (urlObj.pathname.endsWith("/api") || urlObj.pathname.endsWith("/api/")) {
    urlObj.pathname = urlObj.pathname.replace(/\/api\/?$/, "");
  }

  // Set correct path to /collab
  urlObj.pathname = urlObj.pathname.replace(/\/$/, "") + "/collab";

  wsUrl = urlObj.toString();

  console.error(`Connecting to WebSocket: ${wsUrl}`);

  return new Promise<void>((resolve, reject) => {
    let synced = false;

    // Safety timeout
    const timer = setTimeout(() => {
      if (provider) provider.destroy();
      reject(new Error("Connection timeout to collaboration server"));
    }, 25000);

    const provider = new HocuspocusProvider({
      url: wsUrl,
      name: `page.${pageId}`,
      document: ydoc,
      token: collabToken,
      // @ts-ignore - Required for Node.js environment
      WebSocketPolyfill: WebSocket as any,
      onConnect: () => console.error("WS Connect"),
      onDisconnect: () => {
        console.error("WS Disconnect");
        if (!synced) {
          clearTimeout(timer);
          provider.destroy();
          reject(new Error("WebSocket disconnected before sync completed"));
        }
      },
      onClose: () => {
        console.error("WS Close");
        if (!synced) {
          clearTimeout(timer);
          reject(new Error("WebSocket closed before sync completed"));
        }
      },
      onSynced: () => {
        synced = true;
        console.error("Connected and synced!");
        try {
          // Prepare the new content in a separate doc
          const tempDoc = TiptapTransformer.toYdoc(
            tiptapJson,
            "default",
            tiptapExtensions,
          );

          // Clear existing content
          ydoc.transact(() => {
            const fragment = ydoc.getXmlFragment("default");
            if (fragment.length > 0) {
              fragment.delete(0, fragment.length);
            }
          });

          // Apply new content from tempDoc (outside transact to avoid nested transactions)
          const update = Y.encodeStateAsUpdate(tempDoc);
          Y.applyUpdate(ydoc, update);

          console.error(
            "Content replaced. Background persistence in progress (server saves after ~10s debounce)...",
          );

          // Clear safety timeout as we are successful
          clearTimeout(timer);

          // Resolve immediately so the user doesn't have to wait
          resolve();

          // Keep connection open in background for save/sync (Docmost has 10s debounce)
          // The node process will keep running this timeout even after the tool returns
          setTimeout(() => {
            try {
              console.error(`Closing background connection for page ${pageId}`);
              provider.destroy();
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`Warning: failed to close WebSocket: ${msg}`);
            }
          }, 15000);
        } catch (e) {
          clearTimeout(timer);
          provider.destroy();
          reject(e);
        }
      },
      onAuthenticationFailed: () => {
        clearTimeout(timer);
        provider.destroy();
        reject(new Error("Authentication failed for collaboration connection"));
      },
    });
  });
}
