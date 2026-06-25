# Changelog

## [0.2.12] - 2026-06-25

### Añadido
- **Importación/exportación Excel de actividades, turnos de predicación y turnos de comida**: los tres listados incluyen ahora dos dropdowns separados: **JSON** (solo Export JSON) y **Excel** (Export Excel · Download template), más un botón independiente **Import** (acepta `.json` y `.xlsx`). Al seleccionar un Excel el backend resuelve `region_name` → `region_id` y `host_name` → `host_id`, y las actividades resultantes pasan al paso de revisión y selección de secciones. Las filas con errores se muestran como advertencias sin bloquear las demás
- **Plantillas Excel por tipo de actividad**: la plantilla de cada sección omite las columnas `is_preaching_shift` / `is_food_shift` (su valor se fuerza automáticamente al importar según el contexto). La plantilla de Food Shifts sustituye `description` por tres columnas específicas (`host_person_name`, `host_person_address`, `host_person_phone`) que al importar generan automáticamente la descripción: `Estais invitados a comer en casa de {nombre} en {dirección}. Su tel. es {teléfono}.`
- Nuevos endpoints: `GET /activities/import/template`, `GET /activities/export/excel` y `POST /activities/import/parse-excel`

### Corregido
- **is_food_shift no se enviaba al crear/actualizar actividades desde el import modal**: el payload de creación y actualización omitía el flag `is_food_shift`, por lo que los turnos de comida importados se guardaban como actividades generales

---

## [0.2.10] - 2026-06-25

### Añadido
- **Congregación en voluntarios**: nuevo campo que vincula a cada voluntario con su congregación (host del sistema). La ficha del voluntario muestra el nombre, dirección, coordenadas y enlace a Google Maps de la congregación asignada. Es editable desde el modal de identidad con un selector con búsqueda filtrado por las regiones del voluntario. Importable y exportable mediante la columna "Congregación" del Excel (resuelve por nombre del host ignorando mayúsculas; si no hay coincidencia deja el campo vacío)
- **Distancia y congregación en el selector de voluntarios de actividad**: al asignar voluntarios a un grupo de predicación, cada voluntario muestra su distancia en km a la ubicación de la actividad (o al anfitrión como fallback) y el nombre de su congregación. Si el voluntario no tiene dirección propia pero sí congregación, la distancia se calcula desde las coordenadas de la congregación y aparece entre paréntesis junto al nombre de ésta
- **Selección múltiple de voluntarios en grupos de predicación**: el selector de voluntarios para añadir a un grupo de predicación admite ahora selección múltiple, permitiendo añadir varios voluntarios de una sola vez
- **Filtro por nombre en actividades**: nueva caja de búsqueda en la lista de actividades y turnos de predicación que filtra por nombre (búsqueda insensible a mayúsculas en backend)

### Mejorado
- **Filtros de actividades persistentes**: los filtros de la lista de actividades (región, anfitrión, estado, fecha, nombre) se guardan en `sessionStorage` para sobrevivir la navegación SPA; el botón "Clear" los resetea. Los filtros de turnos de predicación se guardan de forma independiente

---

## [0.2.9] - 2026-06-22

### Añadido
- **Distancia y congregación en grupos de anfitriones**: el selector de grupos disponibles para un turno de predicación muestra ahora todos los grupos de la región ordenados por distancia (calculada desde la ubicación de la actividad, o la del anfitrión como fallback, hasta las coordenadas medias de los invitados del grupo), en lugar de filtrar solo por el anfitrión de la actividad
- **Información ampliada en grupos ya asignados**: `ActivityGuestGroupDto` incluye ahora `host_name` y `distance_km`, de modo que los grupos ya asignados muestran los mismos datos que el selector

### Mejorado
- **Selector de grupos multi-selección**: el desplegable para añadir grupos a un turno de predicación permite ahora seleccionar varios grupos a la vez y oculta los grupos sin invitados
- **Asignación entre congregaciones**: eliminada la validación que impedía asignar a un turno grupos de una congregación distinta a la del anfitrión de la actividad

---

## [0.2.8] - 2026-06-22

### Añadido
- **Selector de región al editar grupo**: el formulario de edición de grupos de anfitriones incluye ahora un selector de región, permitiendo cambiar la región asignada al guardar los cambios

---

## [0.2.7] - 2026-06-19

### Añadido
- **Reuniones de congregación en el PDF de horarios**: el PDF del grupo incluye ahora las reuniones semanales del anfitrión (día de semana y fin de semana), ordenadas cronológicamente junto al resto de actividades, con la dirección y enlace a Google Maps
- **Selector de ubicación con autocompletado**: el `location-picker` ahora usa un desplegable de sugerencias de Places API en lugar del mapa interactivo de Google Maps, con un mapa estático como vista previa tras seleccionar una dirección; nuevo módulo `places` en el backend y comando Tauri asociado
- **Exportación de todas las actividades**: el botón "Exportar" en la lista de actividades exporta ahora todas las actividades que cumplan los filtros activos (región, fecha, anfitrión…) en lugar de solo las seleccionadas; el nombre del fichero incluye la región y fecha filtradas si las hay

### Mejorado
- **Importación de voluntarios refactorizada**: el proceso de importación admite ahora columnas adicionales (región, roles, disponibilidad por días/franjas, datos de alojamiento, coordenadas…), detecta duplicados con vista previa de filas, permite actualizar voluntarios existentes (actualización parcial por columnas), y expone un endpoint `/volunteers/truncate` para borrado completo

---

## [0.2.6] - 2026-06-18

### Añadido
- **Crear grupos de predicación al crear actividad**: al crear una nueva actividad se generan automáticamente los grupos de predicación correspondientes
- **Zona de peligro en configuración**: nueva sección en Ajustes con opción de resetear completamente la base de datos (requiere escribir CONFIRMAR para habilitar el botón)
- **Versión visible en el menú**: la versión de la app ahora se muestra en el menú lateral

### Corregido
- **Importación de booleanos**: SQLite3 no puede vincular valores booleanos directamente; se convierten a 0/1 en `buildInsertQuery` para evitar errores al importar la base de datos

---

## [0.2.5] - 2026-06-18

### Añadido
- **Exportación e importación de actividades** con UI de merge para resolver conflictos al importar
- **Comprobación de versión en el escritorio**: la app avisa con un toast cuando hay una versión más reciente disponible para descargar
- **Importación de anfitriones con días de reunión**: el proceso de importación ahora acepta y aplica los días de reunión de cada anfitrión
- **Mejoras en la importación de grupos**: flujo de importación más robusto con nuevos DTOs de validación, respuesta de parseo y commit

### Corregido
- El toast de nueva versión ahora solo se muestra cuando la versión remota es estrictamente más nueva que la local
