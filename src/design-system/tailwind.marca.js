// Lleva a la marca Guerra Farm las paletas que usan las vistas aún sin migrar.
// Cada escala conserva la claridad de la original, para que el contraste se mantenga.
// Se puede borrar cuando todas las vistas usen los tokens de tokens.css.

// Crema y grises cálidos; los tonos oscuros tiran a verde bosque.
const slate = {
  50: '#f2f0e6', 100: '#e8e5d8', 200: '#dcd9cc', 300: '#c9c5b6', 400: '#96908a',
  500: '#6f6a64', 600: '#57534e', 700: '#44403c', 800: '#2a332a', 900: '#1a2a1a', 950: '#121c12',
};

// 500 es Verde Oliva y 600 es Verde Bosque, los colores exactos de la marca.
const emerald = {
  50: '#f1f4e8', 100: '#e1e8d6', 200: '#c5d3a8', 300: '#a9c98a', 400: '#8bb35a',
  500: '#6b8e23', 600: '#2f4f2f', 700: '#263f26', 800: '#1f331f', 900: '#1a2a1a', 950: '#121c12',
};

// 600 es Tierra, el color exacto de la marca.
const indigo = {
  50: '#f8f3ea', 100: '#efe6d8', 200: '#e0cdb0', 300: '#d5b68c', 400: '#b8935f',
  500: '#96744a', 600: '#6b4e2e', 700: '#5a4126', 800: '#4a3418', 900: '#3a2a14', 950: '#241a0c',
};

// 500 es Dorado Trigo; 100 y 700 coinciden con --wheat-100 y --wheat-700.
// Reemplaza al ámbar/naranja de Tailwind: avisos, bodega e insumos extra.
const wheat = {
  50: '#faf6ea', 100: '#f6edd3', 200: '#ecdcae', 300: '#dfc583', 400: '#d3b362',
  500: '#c7a24d', 600: '#a8862f', 700: '#8a6c24', 800: '#6e551d', 900: '#574418', 950: '#2f240b',
};

// Verde Oliva en toda su escala (100 y 800 coinciden con --olive-100 y --olive-800).
const olive = {
  50: '#f6f8ec', 100: '#eaf0d4', 200: '#d6e2ac', 300: '#bccf7c', 400: '#9bb84b',
  500: '#6b8e23', 600: '#5a781d', 700: '#4a6417', 800: '#3d5214', 900: '#334412', 950: '#1b2508',
};

// Azul pizarra apagado: único tono frío de apoyo, para categorías que necesitan
// distinguirse del verde (sueros/electrolitos, agua). Reemplaza al celeste.
const agua = {
  50: '#f1f5f7', 100: '#e1eaef', 200: '#c3d4de', 300: '#9db8c7', 400: '#7097ac',
  500: '#557c91', 600: '#456678', 700: '#3a5463', 800: '#314553', 900: '#2a3a45', 950: '#1a252d',
};

// Rojo de error con tono ladrillo: más cálido que el rosa de Tailwind, mismo contraste.
// 700 es --danger en tokens.css (antes #9f1239, el rosa de Tailwind).
const rose = {
  50: '#fcf3f1', 100: '#f9e4df', 200: '#f2c6bc', 300: '#e79d8d', 400: '#d86e5a',
  500: '#c44a35', 600: '#a83826', 700: '#8c2d1f', 800: '#73261c', 900: '#5f231b', 950: '#33100b',
};

export const coloresMarca = {
  slate,
  emerald,
  teal: emerald,
  green: emerald,
  indigo,
  blue: indigo,
  violet: indigo,
  purple: indigo,
  fuchsia: indigo,
  amber: wheat,
  orange: wheat,
  yellow: wheat,
  sky: agua,
  cyan: agua,
  lime: olive,
  rose,
  red: rose,
  pink: rose,
};
