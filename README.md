# Excel Dashboard

Publicado en **https://excel-dashboard-beta.vercel.app** · código en https://github.com/mauriciochiriboga/excel-dashboard

Convierte cualquier archivo Excel (.xlsx) o CSV con tablas rectangulares en un dashboard analítico interactivo, sin configuración previa. El análisis se hace íntegramente en el navegador. Solo al pulsar **Guardar** el archivo y el esquema se suben a tu cuenta (Supabase) para volver a abrirlos y compartirlos.

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

El proyecto está publicado en Vercel (proyecto `excel-dashboard`, alias `excel-dashboard-beta.vercel.app`).

Desde la terminal, con la CLI de Vercel autenticada:

```bash
vercel deploy --prod
```

Para que cada `git push` a `main` publique automáticamente, conecta el repositorio de GitHub al proyecto en vercel.com (Settings → Git).

### Variables de entorno

| Variable | Dónde | Valor |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` y Vercel | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` y Vercel | Clave `anon` del proyecto |

Ya están cargadas en Vercel para producción, preview y desarrollo. El archivo `.env.local` está ignorado por git.

### Base de datos (Supabase)

Proyecto `excel-dashboard` (ref `cbhzgzulgarmzlbgbhgl`, región São Paulo). El esquema vive en `supabase/migrations/` y se aplica con:

```bash
supabase db push
```

La configuración de autenticación (URL del sitio, redirecciones, confirmación por correo) está en `supabase/config.toml` y se aplica con `supabase config push`. **La confirmación por correo está desactivada** para facilitar las pruebas; para exigirla, pon `enable_confirmations = true` en `[auth.email]` y vuelve a hacer push.

Tablas: `perfiles`, `equipos`, `miembros_equipo`, `invitaciones_equipo`, `dashboards`, `permisos_dashboard`, más el bucket privado `archivos`. Todas con políticas RLS: un dashboard lo ve su propietario, los miembros de su equipo, los usuarios con permiso explícito y cualquiera si es público.

## Cuentas, equipos y permisos

- **Registro** con correo y contraseña en `/auth/registrar`; recuperación en `/auth/recuperar`. El **primer usuario registrado es administrador global**.
- **Guardar** (botón del encabezado) sube el archivo al bucket y el esquema (tipos corregidos, medida principal, filtros, pestaña) a Postgres. Vuelve a abrirse en `/d/<id>` con todo aplicado.
- **Mis dashboards** (`/mis-dashboards`): creados por mí y compartidos conmigo; renombrar y borrar.
- **Equipos** (`/equipos`): crear, invitar por correo con rol lector o editor. Si el correo aún no tiene cuenta, queda una invitación que se aplica sola al registrarse.
- **Compartir** (botón del encabezado, solo el propietario): privado, equipo o público con enlace (`/p/<slug>`, sin sesión). Además, acceso explícito por correo como lector o editor.
- **Administración** (`/admin`, solo administradores): usuarios con rol global y activación, equipos y dashboards de toda la plataforma. Un usuario normal recibe 403.

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
- **Tamaño al guardar**: el bucket limita cada archivo a 50 MB.
- **Edición concurrente**: si dos editores guardan a la vez, gana el último; no hay bloqueo ni historial de versiones.
