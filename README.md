# Excel Dashboard

Convierte cualquier archivo Excel (.xlsx) o CSV con tablas rectangulares en un dashboard analítico interactivo, sin configuración previa. El archivo se procesa íntegramente en el navegador: nada se envía a un servidor.

## Correr en local

Requisitos: Node 20 o superior.

```bash
npm install
npm run dev
```

Abre http://localhost:3000. El botón **Probar con el archivo de muestra** carga `public/muestra.xlsx`.

Otros comandos:

```bash
npm test          # pruebas del motor de detección (Vitest)
npm run build     # compilación de producción
npm run muestra   # regenera public/muestra.xlsx
```

También puedes abrir un archivo por URL: `http://localhost:3000/?url=/ruta/al/archivo.xlsx` (misma origen o con CORS).

## Publicar

El proyecto está pensado para Vercel:

1. Sube el repositorio a GitHub.
2. En vercel.com, **Add New Project**, importa el repositorio y acepta los valores por defecto (framework Next.js).
3. Cada `git push` a `main` publica una nueva versión.

No hay variables de entorno ni backend en esta fase.

## Cómo funciona

```
Archivo → Web Worker (SheetJS) → detección de bloques → encabezados → totales →
despivote de tablas anchas → clasificación de columnas → jerarquías → dashboard
```

Las correcciones que hagas en **Cómo lo entendí** (tipo de columna, suma o promedio, medida principal) se guardan en `localStorage` por archivo y tabla, y se reaplican al volver a cargar el mismo archivo.

## Límites conocidos de la detección automática

- **Bloques**: una tabla es una región rectangular separada de otras por filas o columnas totalmente vacías. Dos tablas pegadas sin separación se detectan como una sola.
- **Títulos**: se reconoce como título una fila con una sola celda de texto (o dos, si una es larga) justo encima de la tabla. Títulos de más de dos filas se ignoran.
- **Encabezados**: se soportan una o dos filas. Con dos filas, el nivel superior se rellena hacia la derecha (celdas combinadas) y los nombres se fusionan como `Padre · Hijo`. Tres o más niveles no se soportan.
- **Tablas anchas**: si el encabezado contiene años o meses repetidos en columnas, la tabla se convierte a formato largo (`Año`, `Valor`). Si los grupos no tienen las mismas subcolumnas no se despivota.
- **Totales**: se excluyen filas cuya primera celda empieza por "Total", "Subtotal", "Suma" o cuyos valores coinciden con la suma de la columna (tolerancia 0,5 %). Subtotales intermedios sin esa etiqueta se mantienen como filas normales.
- **Etiquetas combinadas verticalmente**: las celdas vacías de columnas de texto con más del 30 % de huecos se rellenan con el valor superior.
- **Tipos**: una columna numérica con tantos valores distintos como filas es identificador solo si parece secuencia o código; los importes con valores únicos siguen siendo medida. Los porcentajes se detectan por nombre (`%`, tasa, ratio) o por valores entre 0 y 1.
- **Fechas**: se reconocen fechas de Excel, texto `dd/mm/aaaa`, `aaaa-mm-dd` y años (`2024`, `2024 (p)`). Otros formatos quedan como texto.
- **Notas al pie** muy alejadas de la tabla (más de 5.000 filas vacías) se descartan.
- **Rendimiento**: 50.000 filas cargan en pocos segundos. Libros con decenas de hojas y rangos inflados (hojas que declaran un millón de filas por formato) pueden tardar más de 10 s.
- **Archivos protegidos** con contraseña no se pueden leer; la app muestra un mensaje claro.
