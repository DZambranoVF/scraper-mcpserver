import { Stagehand } from "@browserbasehq/stagehand";
import { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { getServerInstance, operationLogs } from "./logging.js";
import { addScreenshot } from "./resources.js";
import { TOOLS_EXTENDED } from "./tools_extended.js";

// Define the Stagehand tools
export const TOOLS: Tool[] = [
  {
    name: "stagehand_navigate",
    description: "Navigate to a URL in the browser. Only use this tool with URLs you're confident will work and stay up to date. Otheriwse use https://google.com as the starting point",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to navigate to" },
      },
      required: ["url"],
    },
  },
  {
    name: "stagehand_act",
    description: `Performs an action on a web page element. Act actions should be as atomic and 
      specific as possible, i.e. "Click the sign in button" or "Type 'hello' into the search input". 
      AVOID actions that are more than one step, i.e. "Order me pizza" or "Send an email to Paul 
      asking him to call me". `,
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: `The action to perform. Should be as atomic and specific as possible, 
          i.e. 'Click the sign in button' or 'Type 'hello' into the search input'. AVOID actions that are more than one 
          step, i.e. 'Order me pizza' or 'Send an email to Paul asking him to call me'. The instruction should be just as specific as possible, 
          and have a strong correlation to the text on the page. If unsure, use observe before using act."` },
        variables: {
          type: "object",
          additionalProperties: true,
          description: `Variables used in the action template. ONLY use variables if you're dealing 
            with sensitive data or dynamic content. For example, if you're logging in to a website, 
            you can use a variable for the password. When using variables, you MUST have the variable
            key in the action template. For example: {"action": "Fill in the password", "variables": {"password": "123456"}}`,
        },
      },
      required: ["action"],
    },
  },
  {
    name: "stagehand_extract",
    description: `Extracts all of the text from the current page.`,
    inputSchema: {
      type: "object",
      properties: {
        "summary": {
          type: "string",
          description: "A summary of the content of the page. This should be a single sentence that captures the main objective to extract from the page.",
        }
      },
      required: ["summary"],
    },
  },
  {
    name: "stagehand_observe",
    description: "Observes elements on the web page. Use this tool to observe elements that you can later use in an action. Use observe instead of extract when dealing with actionable (interactable) elements rather than text. More often than not, you'll want to use extract instead of observe when dealing with scraping or extracting structured text.",
    inputSchema: {
      type: "object",
      properties: {
        instruction: {
          type: "string",
          description: "Instruction for observation (e.g., 'find the login button'). This instruction must be extremely specific.",
        },
      },
      required: ["instruction"],
    },
  },
  {
    name: "screenshot",
    description: "Takes a screenshot of the current page. Use this tool to learn where you are on the page when controlling the browser with Stagehand. Only use this tool when the other tools are not sufficient to get the information you need.",
    inputSchema: {
      type: "object",
      properties: {
        "summary": {
          type: "string",
          description: "A single sentence that captures the main objective to check from the page.",
        }
      },
      required: ["summary"],
    },
  },
  {
      name: "stagehand_custom_eval",
      description: "Evalúa código JavaScript arbitrario en la página.",
      inputSchema: {
        type: "object",
        properties: {
          script: {
            type: "string",
            description: "El código JavaScript que se debe ejecutar en el contexto del navegador.",
          }
        },
        required: ["script"]
      }
    },
    {
      name: "stagehand_ping",
      description: "Tool de prueba para saber si este es MI servidor.",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
    },


    ...TOOLS_EXTENDED
];

// Handle tool calls
export async function handleToolCall(
  name: string,
  args: any,
  stagehand: Stagehand
): Promise<CallToolResult> {
  switch (name) {
    case "stagehand_navigate":
      try {
        // Espera a que no haya conexiones de red activas antes de continuar
        await stagehand.page.goto(args.url, {
          waitUntil: "domcontentloaded",
          timeout:   args.timeout || 60000
        });
        return {
          content: [{ type: "text", text: `Navegado a: ${args.url}` }],
          isError: false,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error al navegar: ${msg}` }],
          isError: true,
        };
      }


    case "stagehand_act":
      try {
        await stagehand.page.act({
          action: args.action,
          variables: args.variables,
          slowDomBasedAct: false,
        });
        return {
          content: [
            {
              type: "text",
              text: `Action performed: ${args.action}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to perform action: ${errorMsg}`,
            },
            {
              type: "text",
              text: `Operation logs:\n${operationLogs.join("\n")}`,
            },
          ],
          isError: true,
        };
      }

    case "stagehand_extract": {
      try {
        const bodyText = await stagehand.page.evaluate(() => document.body.innerText);
        const content = bodyText
          .split('\n')
          .map(line => line.trim())
          .filter(line => {
            if (!line) return false;
            if (
                (line.includes('{') && line.includes('}')) ||
                line.includes('@keyframes') ||                         // Remove CSS animations
                line.match(/^\.[a-zA-Z0-9_-]+\s*{/) ||               // Remove CSS lines starting with .className {
                line.match(/^[a-zA-Z-]+:[a-zA-Z0-9%\s\(\)\.,-]+;$/)  // Remove lines like "color: blue;" or "margin: 10px;"
              ) {
              return false;
            }
            return true;
          })
          .map(line => {
            return line.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
              String.fromCharCode(parseInt(hex, 16))
            );
          });

        return {
          content: [
            {
              type: "text",
              // text: JSON.stringify({ content: content }, null, 2),
              text: `Extracted content:\n${content.join('\n')}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to extract content: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    }

    case "stagehand_ping": {
      return {
        content: [{ type: "text", text: "✅ Este es MI servidor MCP personalizado." }],
        isError: false
      };
    }


    case "stagehand_observe":
      try {
        const observations = await stagehand.page.observe({
          instruction: args.instruction,
          returnAction: false,
        });
        return {
          content: [
            {
              type: "text",
              text: `Observations: ${JSON.stringify(observations)}`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to observe: ${errorMsg}`,
            },
            {
              type: "text",
              text: `Operation logs:\n${operationLogs.join("\n")}`,
            },
          ],
          isError: true,
        };
      }
    
    case "stagehand_custom_eval": {
      try {
        const result = await stagehand.page.evaluate(args.script);
        return {
          content: [{ type: "text", text: `Resultado:\n${JSON.stringify(result, null, 2)}` }],
          isError: false
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error en custom_eval: ${(err as Error).message}` }],
          isError: true
        };
      }
    }


    case "screenshot":
      try {
        const screenshotBuffer = await stagehand.page.screenshot({ 
          fullPage: false 
        });

        // Convert buffer to base64 string and store in memory
        const screenshotBase64 = screenshotBuffer.toString('base64');
        const name = `screenshot-${new Date().toISOString().replace(/:/g, '-')}`;

        // Get the session ID from the Stagehand instance
        const sessionId = stagehand.browserbaseSessionID || 'unknown';

        // Store with session tracking
        addScreenshot(sessionId, name, screenshotBase64);

        // Notify the client that the resources changed
        const serverInstance = getServerInstance();
        if (serverInstance) {
          serverInstance.notification({
            method: "notifications/resources/list_changed",
          });
        }

        return {
          content: [
            {
              type: "text",
              text: `Screenshot taken with name: ${name}`,
            },
            {
              type: "image",
              data: screenshotBase64,
              mimeType: "image/png",
            },
          ],
          isError: false,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Failed to take screenshot: ${errorMsg}`,
            },
            {
              type: "text",
              text: `Operation logs:\n${operationLogs.join("\n")}`,
            },
          ],
          isError: true,
        };
      }
    // ——— TOOLS EXTENDIDAS FINAL CON CASTS ———

    case "stagehand_detect_forms": {
      try {
        const mainForms = await stagehand.page.$$eval("form", (forms: any[]) =>
          forms.map((form: any) => { /* … */ })
        );
        const frameForms: any[] = [];
        for (const frame of stagehand.page.frames()) {
          if (frame === stagehand.page.mainFrame()) continue;
          try {
            const ffs = await frame.$$eval("form", (forms: any[]) =>
              forms.map((form: any) => ({ /* … */ }))
            );
            frameForms.push(...ffs);
          } catch { /* cross‐origin */ }
        }
    
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify([...mainForms, ...frameForms], null, 2)
            }
          ],
          isError: false
        };
      } catch (err) {
        return {
          content: [
            { type: "text", text: `Error in detect_forms: ${(err as Error).message}` }
          ],
          isError: true
        };
      }
    }
    
    case "stagehand_detect_ctas": {
      try {
        const ctas = await stagehand.page.$$eval(
          "a, button, input[type='button'], input[type='submit']",
          (els: any[]) => els.map((el: any) => { /* … */ })
        );
    
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(ctas, null, 2)
            }
          ],
          isError: false
        };
      } catch (err) {
        return {
          content: [
            { type: "text", text: `Error in detect_ctas: ${(err as Error).message}` }
          ],
          isError: true
        };
      }
    }
    
    case "stagehand_detect_products": {
      let products: any[] = [];
    
      try {
        const hints: string[] = Array.isArray(args.hints) ? args.hints : [];
        products = await stagehand.page.$$eval(
          "div, section, article, li",
          (elements: any[], hintsLocal: string[]) => {
            return elements
              .filter((el: any) => {
                const txt = (el.textContent || "").toLowerCase();
                // w es string, y usamos hintsLocal
                return hintsLocal.some((w: string) => txt.includes(w.toLowerCase()));
              })
              .map((el: any) => {
                const ds = { ...el.dataset };
                const img = el.querySelector("img") as HTMLImageElement;
                const link = el.querySelector("a") as HTMLAnchorElement;
                return {
                  id:           el.id,
                  classList:    Array.from(el.classList),
                  dataset:      ds,
                  text:         el.textContent?.trim() || null,
                  price:        (el.querySelector(".price") as HTMLElement)?.innerText.trim() || null,
                  availability: (el.querySelector(".availability") as HTMLElement)?.innerText.trim() || null,
                  quantity:     (el.querySelector("input[type='number']") as HTMLInputElement)?.value || null,
                  image:        img?.getAttribute("src") || null,
                  link:         link?.getAttribute("href") || null
                };
              });
          },
          // ⚠️ Pasamos hints **fuera** del callback
          hints
        );
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Error in detect_products: ${(err as Error).message}`
            }
          ],
          isError: true
        };
      }
    
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(products, null, 2)
          }
        ],
        isError: false
      };
    }
    
    

    case "stagehand_snapshot_dom": {
      try {
        const html = await stagehand.page.content();
        return {
          content: [
            ({
              type: "resource",
              resource: { json: { dom: html }, mimeType: "application/json" },
            } as any)
          ],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error in snapshot_dom: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }

    case "stagehand_get_metrics": {
      try {
        // casteamos page a any para llamar metrics()
        const puppeteerMetrics = await (stagehand.page as any).metrics();
        const performanceTiming = await stagehand.page.evaluate(() =>
          JSON.parse(JSON.stringify(window.performance.timing))
        );
        const resources = await stagehand.page.evaluate(() =>
          performance.getEntriesByType("resource").map((r: any) => ({
            name: r.name,
            entryType: r.entryType,
            startTime: r.startTime,
            duration: r.duration,
            initiatorType: r.initiatorType,
          }))
        );
        return {
          content: [
            ({
              type: "resource",
              resource: {
                json: { puppeteerMetrics, performanceTiming, resources },
                mimeType: "application/json",
              },
            } as any)
          ],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error in get_metrics: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }

    // ——— Detectar scrollers ———
    case "stagehand_detect_scrollers": {
      let scrollers: any[] = [];
    
      try {
        scrollers = await stagehand.page.$$eval(
          "*",
          (els: any[]) =>
            els
              .filter((n: any) => {
                const s = window.getComputedStyle(n);
                return (s.overflowY === "scroll" || s.overflowY === "auto") && n.scrollHeight > n.clientHeight;
              })
              .map((n: any) => {
                const rect = n.getBoundingClientRect();
                return {
                  id:           n.id,
                  boundingBox:  { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
                };
              })
        );
      } catch (err) {
        return {
          content: [
            { type: "text", text: `Error in detect_scrollers: ${(err as Error).message}` }
          ],
          isError: true
        };
      }
    
      // Aquí serializamos como texto
      return {
        content: [
          { type: "text", text: JSON.stringify(scrollers, null, 2) }
        ],
        isError: false
      };
    }
    
    
    case "stagehand_inject_event_tracker": {
      try {
        await stagehand.page.evaluate(() => {
          (window as any).__trackedEvents = [];
          const orig = EventTarget.prototype.addEventListener;
          EventTarget.prototype.addEventListener = function (type, listener, opts) {
            // casteamos this a any para leer tagName
            const tag = (this as any).tagName || this.constructor.name;
            (window as any).__trackedEvents.push({ target: tag, type });
            return orig.call(this, type, listener, opts);
          };
        });
        return {
          content: [{ type: "text", text: "Event tracker inyectado" }],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error inyectando tracker: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }

    case "stagehand_get_tracked_events": {
      try {
        const events = await stagehand.page.evaluate(() => (window as any).__trackedEvents || []);
        return {
          content: [
            ({
              type: "resource",
              resource: { json: events, mimeType: "application/json" },
            } as any)
          ],
          isError: false,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error leyendo eventos: ${(err as Error).message}` }],
          isError: true,
        };
      }
    }

    // ——— FIN TOOLS EXTENDIDAS FINAL ———



    default:
      return {
        content: [
          {
            type: "text",
            text: `Unknown tool: ${name}`,
          },
          {
            type: "text",
            text: `Operation logs:\n${operationLogs.join("\n")}`,
          },
        ],
        isError: true,
      };
  }
} 