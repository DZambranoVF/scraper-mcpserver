import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const TOOLS_EXTENDED: Tool[] = [
  {
    name: "stagehand_detect_forms",
    description: "Detecta todos los formularios de la página (incluyendo inputs, selects, textareas), sus atributos y handlers inline.",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "stagehand_detect_ctas",
    description: "Detecta botones y llamadas a la acción visibles. Incluye texto, atributos, bounding-box, visibilidad y handlers inline.",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "stagehand_detect_products",
    description: "Detecta productos en e-commerce con nombre, precio, disponibilidad, cantidad, imagen, link y data-attributes. Usa selectores comunes o, si no, heurísticos genéricos.",
    inputSchema: {
      type: "object",
      properties: {
        hints: {
          type: "array",
          items: { type: "string" },
          description: "Pistas como 'precio', 'producto', 'imagen' para orientar el análisis"
        }
      },
      required: []
    }
  },
  {
    name: "stagehand_snapshot_dom",
    description: "Captura el DOM completo (main frame y frames same-origin) como HTML dentro de un JSON.",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "stagehand_get_metrics",
    description: "Obtiene métricas de performance (puppeteer metrics, performance.timing y recursos cargados).",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "stagehand_detect_scrollers",
    description: "Detecta todos los contenedores con scroll (overflow auto/scroll y scrollHeight>clientHeight).",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "stagehand_inject_event_tracker",
    description: "Inyecta un override de addEventListener para trackear dinámicamente clicks, scrolls e inputs.",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "stagehand_get_tracked_events",
    description: "Recupera la lista de eventos registrados tras la inyección (click, scroll, input, etc.).",
    inputSchema: { type: "object", properties: {}, required: [] }
  }
];

