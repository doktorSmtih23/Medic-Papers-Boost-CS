
import { GoogleGenAI, Type } from "@google/genai";
import type { AnalysisResult } from '../types';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  // En una aplicación real, es posible que desees manejar esto con más elegancia.
  // En este contexto, asumimos que la clave está disponible.
  console.warn("La variable de entorno API_KEY no está configurada.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        summary: {
            type: Type.STRING,
            description: "El resumen en formato de cadena de texto HTML autocontenida."
        },
        quiz: {
            type: Type.OBJECT,
            properties: {
                quizTitle: {
                    type: Type.STRING,
                    description: "Título del quiz relacionado con el documento."
                },
                settings: {
                    type: Type.OBJECT,
                    properties: {
                        positiveScore: { type: Type.NUMBER },
                        negativeScore: { type: Type.NUMBER }
                    },
                    required: ['positiveScore', 'negativeScore']
                },
                questions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            questionText: { type: Type.STRING },
                            options: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                            },
                            correctAnswerIndex: { type: Type.INTEGER },
                            explanation: { type: Type.STRING },
                            topic: { 
                                type: Type.STRING,
                                description: "El tema principal o sección del documento al que se refiere esta pregunta (ej. 'Diagnóstico', 'Protocolo de Tratamiento')."
                            }
                        },
                        required: ['questionText', 'options', 'correctAnswerIndex', 'explanation', 'topic']
                    }
                }
            },
            required: ['quizTitle', 'settings', 'questions']
        },
        flashcards: {
            type: Type.ARRAY,
            description: "Un array de términos médicos clave y sus definiciones del documento.",
            items: {
                type: Type.OBJECT,
                properties: {
                    term: {
                        type: Type.STRING,
                        description: "El término o concepto médico."
                    },
                    definition: {
                        type: Type.STRING,
                        description: "Una definición o explicación concisa del término."
                    },
                    topic: {
                        type: Type.STRING,
                        description: "El tema principal o sección del documento al que se refiere esta tarjeta (ej. 'Farmacología', 'Diagnóstico')."
                    }
                },
                required: ['term', 'definition', 'topic']
            }
        }
    },
    required: ['summary', 'quiz', 'flashcards']
};

export async function generateMedicalAnalysis(pdfText: string): Promise<AnalysisResult> {
    const model = 'gemini-2.5-pro';

    const prompt = `
        Eres "MedicoBoost AI", un asistente experto en procesamiento de documentos médicos y gamificación educativa. Tu propósito es transformar documentos médicos densos en tres productos distintos y de alta calidad: un Resumen, un Quiz de Evaluación y un conjunto de Tarjetas de Estudio (Flashcards).

        Basado en el contenido del documento médico proporcionado, genera un objeto JSON con tres claves raíz: "summary", "quiz" y "flashcards".

        1.  **summary**: El valor de esta clave debe ser una única cadena de texto HTML autocontenida. Este es el resultado más crítico. DEBE ser visualmente atractivo y altamente estructurado, no solo texto plano. Adhiérete estrictamente a la siguiente estructura y requisitos:
            *   **Un Bloque \`<style>\` Autocontenido:** Esto es OBLIGATORIO. Proporciona CSS completo para un diseño profesional, moderno y **totalmente adaptable (responsive)**. Usa paletas de colores profesionales (ej. azules, grises). La fuente base debe coincidir con la de la aplicación: \`font-family: 'Inter', sans-serif;\`.
                *   **Legibilidad General:** Establece un \`font-size\` y \`line-height\` base cómodos para el texto del cuerpo.
                *   **Encabezados de Sección (\`<h2>\`):** Estilízalos para una jerarquía visual clara. Deben tener un \`font-size\` más grande, un \`font-weight\` mayor (ej. 600), un \`color\` distintivo (ej. un azul profesional como #1E40AF), un borde inferior sutil (ej. \`border-bottom: 2px solid #BFDBFE;\`), y padding y márgenes adecuados. Asegúrate de que el icono SVG en línea esté perfectamente alineado usando flexbox.
                *   **Tarjetas de Puntos Clave:**
                    *   El contenedor (\`.card-grid\`) DEBE ser una cuadrícula adaptable (\`display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));\`).
                    *   Las tarjetas individuales (\`.card\`) deben tener un aspecto limpio con fondo blanco, un borde suave (\`border: 1px solid #e5e7eb;\`), esquinas redondeadas (\`border-radius: 0.75rem;\`), amplio padding y una sombra de caja refinada (\`box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);\`).
                    *   Añade un efecto sutil al pasar el ratón (\`transform: translateY(-4px);\`) para interactividad.
                *   **Tablas Estilizadas (CRÍTICO):**
                    *   Cada elemento \`<table>\` DEBE estar envuelto en un div contenedor, por ejemplo \`<div class="table-wrapper">\`.
                    *   La clase contenedora (\`.table-wrapper\`) DEBE tener \`overflow-x: auto;\` para asegurar que las tablas se desplacen horizontalmente en pantallas pequeñas y no rompan el diseño de la página.
                    *   La tabla en sí debe tener \`width: 100%;\` y \`border-collapse: collapse;\`.
                    *   Los encabezados de tabla (\`<th>\`) deben ser distintos: usa un fondo gris claro (\`background-color: #f3f4f6;\`), fuente en negrita y padding suficiente (\`padding: 0.75rem;\`).
                    *   Las filas de la tabla (\`<td>\`) deben tener bordes claros (\`border: 1px solid #e5e7eb;\`) y padding. Usa colores de fila alternos (\`tr:nth-child(even) { background-color: #f9fafb; }\`) para facilitar la lectura.
                *   **Perlas Clínicas (\`<blockquote>\`) (CRÍTICO):** Deben ser estilizadas como llamadas de atención prominentes. Estiliza la etiqueta \`<blockquote>\` directamente con un fondo azul claro (\`background-color: #EFF6FF;\`), un borde izquierdo grueso de un azul más oscuro (\`border-left: 5px solid #3B82F6;\`), padding generoso (\`padding: 1rem;\`) y esquinas redondeadas (\`border-radius: 0.5rem;\`). El color del texto debe ser un gris azulado oscuro para la legibilidad (\`color: #1E3A8A;\`).
                *   **Tooltips Interactivos:** Proporciona un estilo limpio para \`.tooltip\` y \`.tooltiptext\`. El tooltip en sí debe ser oscuro con texto blanco para un alto contraste.
                *   **ESTILOS DE IMPRESIÓN CRÍTICOS:** Este bloque \`<style>\` DEBE incluir una regla \`@media print\` que logre lo siguiente:
                    1.  Aplica un margen de al menos \`40pt\` al contenedor principal imprimible.
                    2.  **OBLIGATORIO E INNEGOCIABLE:** DEBES incluir la regla \`.card, section, blockquote, table { page-break-inside: avoid !important; }\` para evitar que estos elementos cruciales se dividan entre páginas impresas. Este es un requisito crítico para un resultado profesional.
                    3.  Elimine todas las sombras de caja, fondos innecesarios y asegure que el texto sea negro para una impresión óptima. Los tooltips deben ocultarse.
            *   **Contenido del Cuerpo HTML:**
                *   **Título Principal:** Comienza con un \`<h1>\` que contenga el tema principal del documento.
                *   **Puntos Clave:** Esta sección es OBLIGATORIA. Genera los 5-7 puntos más vitales. Muéstralos en una cuadrícula adaptable de "tarjetas" visualmente distintas usando las clases \`.card-grid\` y \`.card\`. Cada tarjeta debe tener un borde, una sombra sutil y un icono.
                *   **Secciones Temáticas:** Para cada tema principal (ej. Diagnóstico, Tratamiento), crea una \`<section>\`. Cada sección DEBE comenzar con un \`<h2>\` estilizado que contenga un icono SVG en línea relevante y el título de la sección. La etiqueta \`<section>\` contenedora NO DEBE tener fondo ni borde.
                *   **Formato de Contenido Enriquecido:** Dentro de cada sección, DEBES usar el HTML apropiado para estructurar el contenido. Usa:
                    *   \`<strong>\` para términos importantes.
                    *   \`<ul>\` con \`<li>\` para listas con viñetas.
                    *   \`<table>\` para presentar datos estructurados (ej. dosis de medicamentos, criterios de diagnóstico). Las tablas son esenciales para la claridad y deben estar envueltas en un div para el desplazamiento horizontal.
                    *   \`<blockquote>\` estilizado como "Perla Clínica" o "Consejo Profesional" para resaltar consejos cruciales.
                *   **Tooltips Interactivos (OBLIGATORIO):** Escanea el texto en busca de al menos 5-10 términos médicos complejos. Para cada uno, envuélvelo en la estructura de tooltip: \`<span class="tooltip">Término<span class="tooltiptext">Una breve definición.</span></span>\`. Esto no es opcional.

        2.  **quiz**: El valor de esta clave debe ser un objeto JSON para un "Quiz Interactivo". Este JSON debe:
            *   Contener un 'quizTitle'.
            *   Contener un objeto 'settings' con 'positiveScore: 10' y 'negativeScore: -5'.
            *   Contener un array 'questions' de exactamente 20 preguntas de opción múltiple si el material de origen lo permite.
            *   Cada objeto de pregunta debe tener 'questionText', 'options' (un array de 4 cadenas de texto), 'correctAnswerIndex' (número del 0 al 3), 'explanation' y 'topic'. El 'topic' debe ser una cadena corta que identifique la parte del documento a la que se refiere la pregunta (ej. "Fisiopatología", "Guías de Tratamiento").
            
        3.  **flashcards**: El valor de esta clave debe ser un array JSON de al menos 10 objetos de tarjetas de estudio. Cada objeto debe contener tres claves: "term", "definition" y "topic".
            *   "term": Un término médico clave, concepto o abreviatura del documento.
            *   "definition": Una definición concisa y precisa del término, basada estrictamente en el documento proporcionado.
            *   "topic": Una cadena corta que identifique la parte del documento a la que se refiere la tarjeta (ej. "Farmacología", "Criterios de Diagnóstico").

        Aquí está el contenido del documento médico:
        ---
        ${pdfText}
        ---
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            }
        });
        
        const jsonText = response.text.trim();
        const parsedResult = JSON.parse(jsonText);

        // Validación básica
        if (!parsedResult.summary || !parsedResult.quiz || !parsedResult.quiz.questions || !parsedResult.flashcards) {
            throw new Error("Estructura de respuesta inválida del modelo de IA.");
        }

        return parsedResult as AnalysisResult;

    } catch (error) {
        console.error("Error al llamar a la API de Gemini:", error);
        throw new Error("No se pudo generar el análisis desde el modelo de IA.");
    }
}
