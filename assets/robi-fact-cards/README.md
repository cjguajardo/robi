# ROBI · Curiosidades Tech

Plantilla HTML autónoma con 67 láminas coleccionables educativas: 27 del abecedario español para niños de 6 a 7 años y 40 sobre programación, ingeniería de software, historia de la computación y temas relacionados.

Los títulos usan hasta cuatro palabras. Cada explicación expresa una sola idea con un máximo de once palabras, para acompañar a niños que comienzan a leer.

## Uso

Abre `index.html` en un navegador moderno. La colección permite:

- filtrar las láminas por tema;
- abrir la fuente de cada dato;
- revisar cada grupo como una hoja A4 individual;
- imprimir nueve láminas por hoja A4, en una cuadrícula de 3 × 3;
- volver a paginar automáticamente la vista cuando se aplica un filtro;
- mostrar una ilustración individual y pertinente de ROBI en cada tarjeta.
- imprimir nueve reversos Circuit Core desde `print-backs.html`, con la misma grilla física de las caras frontales.

## Personalización

- `alphabet.js`: las 27 letras, palabras, significados e imágenes para lectores de 6 a 7 años.
- `facts.js`: contenido, fuente, tema e imagen de cada lámina histórica.
- `images/alphabet/`: 27 ilustraciones individuales del abecedario.
- `images/facts/`: 40 ilustraciones individuales de curiosidades tecnológicas.
- `images/backs/`: dos reversos coleccionables de ROBI, preparados en proporción 61:85.
- `styles.css`: sistema visual, colores por categoría y reglas de impresión.
- `app.js`: render, filtros y acción de impresión.

Las ilustraciones se crearon a partir de `../sticker1.PNG` y `../sticker2.PNG` para mantener el mismo diseño de ROBI, pero cada tarjeta carga un PNG propio.
