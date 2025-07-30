
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const TOOLS_EXTENDED: Tool[] = [
  {
    name: "stagehand_detect_forms",
    description: "Detecta todos los formularios de la página incluyendo inputs, selects, textareas, y sus atributos.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "stagehand_detect_ctas",
    description: "Detecta botones o llamadas a la acción visibles en la página. Incluye texto, clases CSS, posición y visibilidad.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "stagehand_detect_products",
    description: "Detecta productos en e-commerce con nombre, precio, disponibilidad, imagen y link si están disponibles.",
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
    description: "Captura el DOM completo de la página como JSON para análisis estructurado o comparación de versiones.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "stagehand_get_metrics",
    description: "Obtiene métricas de carga de la página: tiempo de carga, scripts, imágenes, recursos bloqueados, etc.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  }
];
