# Changelog

## [0.7.0] - 2026-06-30

### Añadido

- **Asignación y desasignación manual desde el calendario de planning**: en el modo Planning de la lista de grupos de invitados, cada columna de día incluye un botón "+" que abre un flujo modal de 3 pasos para asignar actividades generales, turnos de comida o turnos de predicación al grupo; para los turnos de predicación, un tercer paso permite escoger el grupo de predicación concreto. Las actividades que superan los límites de campaña o tienen restricciones (conflicto de horario, mismo nombre, reunión de congregación, límite alcanzado) aparecen deshabilitadas con el motivo indicado. Cada actividad asignada muestra un botón "×" para desasignarla directamente desde el calendario
- **Información ampliada en el modal de asignación**: el listado de actividades disponibles muestra congregación del anfitrión, número de grupos y de invitados ya asignados, y distancia en km al grupo; los turnos de predicación muestran además las mismas columnas de congregación, grupos e invitados que aparecen en la lista de turnos de predicación
- **Ventana de planning independiente**: botón de icono de calendario en la lista de actividades (pestaña Grupos y pestaña Invitados de cada grupo de predicación), en la lista de grupos de invitados (modo Planning) y en el sub-tab Guests de cada grupo de predicación; al hacer clic abre el calendario del grupo en una ventana Tauri separada con diseño de solo lectura
- **Endpoint `GET /activities/available-for-group`**: devuelve las actividades disponibles para asignar a un grupo en una fecha concreta, con validación de todos los límites y restricciones de campaña y cálculo de distancia

### Corregido

- **Turnos de hospitalidad contabilizados incorrectamente como actividades generales**: al asignar un grupo a un turno de comida, el contador de actividades generales no se incrementa, permitiendo que un grupo tenga el máximo de actividades generales y además uno o más turnos de comida

---

## [0.6.0] - 2026-06-30

### Añadido

- **Auto-asignación para actividades generales no tipificadas**: nuevo botón "Auto-assign" en la pestaña Grupos de cada actividad general que aplica el mismo algoritmo greedy por distancia que los turnos de comida; excluye automáticamente los grupos que ya tienen un turno de comida asignado el mismo día, respeta el límite de actividades por grupo y el aforo máximo si está configurado
- **Auto-asignación masiva de actividades generales**: botón "Auto-assign all" en la cabecera del listado general de actividades con modal de confirmación que explica el algoritmo y los criterios de elegibilidad; muestra un panel de resultado con el número de actividades procesadas y los grupos omitidos por aforo
- **Invitación abierta a grupos por congregación o región**: dos nuevos toggles en el formulario de edición de actividades generales — "Invitar a todos los grupos de la congregación" (requiere host asignado; se deshabilita automáticamente si está activo el de región) e "Invitar a todos los grupos de la región"; cuando alguno está activo, todos los grupos del ámbito correspondiente ven la actividad en su calendario PDF sin necesidad de asignación manual
- **Restricción de mismo nombre entre actividades generales**: los grupos de invitados no pueden asignarse a dos actividades no tipificadas con el mismo nombre; los grupos ya en conflicto aparecen como no disponibles en el selector con el motivo indicado
- **Ajuste para desactivar la restricción de mismo nombre**: nuevo checkbox en Ajustes → Límites de campaña que permite desactivar globalmente la restricción de mismo nombre en actividades generales

### Mejorado

- **Límite de turnos de comida por grupo configurable**: nuevo ajuste `max_food_shifts_per_group` en la página de Ajustes (por defecto 1); la validación al asignar y el estado del selector en frontend respetan este valor en lugar del límite fijo anterior
- **Nombres de actividad normalizados al importar**: el campo `name` de `CreateActivityDto` aplica un `@Transform` de trim automático para eliminar espacios iniciales y finales, evitando que actividades con el mismo nombre difieran por espacios invisibles

---

## [0.5.0] - 2026-06-29

### Añadido

- **Auto-asignación masiva de grupos de invitados a turnos de predicación**: nuevo botón "Auto-assign" en cada turno de predicación que aplica un algoritmo greedy para asignar automáticamente los mejores grupos disponibles; prioriza los grupos más cercanos a la ubicación del turno, respeta el límite configurado de grupos por turno, descarta grupos ya asignados, deshabilitados o en conflicto de mismo día, y muestra el resultado con el número de grupos asignados
- **Auto-asignación masiva para toda la campaña**: nuevo botón de acción global en la cabecera de turnos de predicación que ejecuta el algoritmo greedy en todos los turnos de la campaña de una sola vez
- **Modal de confirmación con explicación del algoritmo**: antes de ejecutar la auto-asignación (individual o masiva) se muestra un modal que explica el algoritmo (distancia, límites, conflictos) y los criterios de elegibilidad, con opción de cancelar
- **Límite de grupos de invitados por turno de predicación**: nuevo ajuste `max_guest_groups_per_preaching_shift` en la página de Ajustes; en la vista de detalle del turno aparece un contador informativo que muestra los grupos asignados frente al límite configurado
- **Acciones masivas de reset con modal Angular**: los botones de reset de grupos de invitados y voluntarios usan ahora modales de confirmación de Angular en lugar de `window.confirm` / `window.alert`

### Mejorado

- **Contador de invitados por grupo**: el contador muestra el total de invitados (suma de personas) en lugar del número de grupos de invitados asignados al turno
- **Contador de grupos oculto cuando el límite es 0**: cuando `max_guest_groups_per_preaching_shift` es 0 (sin límite), el contador informativo no se muestra

---

## [0.4.2] - 2026-06-27

### Añadido

- **Mapas desplegables en listados de actividades, turnos de predicación, turnos de comida y carros**: panel de mapa colapsable en la cabecera de cada listado que muestra las ubicaciones filtradas como puntos azules con el estilo de punto personalizado; mismo estilo aplicado al mapa de carros existente
- **Mapa de grupos en el detalle de actividad**: diseño en dos columnas dentro de la pestaña Grupos (columna derecha de 440px, altura 520px fija); los grupos asignados se muestran como puntos naranja con líneas discontinuas y etiquetas de distancia al primer punto de la actividad; los grupos disponibles (no deshabilitados) aparecen como puntos grises y al clicar en uno se despliega una tarjeta de asignación bajo el mapa
- **Sub-pestañas y mapa de invitados en grupos de predicación**: cada grupo de predicación expandido tiene ahora pestañas Voluntarios / Invitados / Carros en lugar del diseño apilado anterior; la pestaña Invitados usa el mismo diseño lista+mapa que la pestaña de grupos de la actividad
- **Límites de actividad por grupo configurables desde Ajustes**: los superadmins pueden configurar `max_activities_per_group` y `max_preaching_shifts_per_group` desde la página de Ajustes; los valores se almacenan en la nueva tabla `campaign_settings` (migración incluida, valores por defecto 4); el backend valida los límites al asignar y devuelve los contadores al frontend para deshabilitar selectores y filtrar marcadores del mapa
- **Logo y cabecera en PDFs de horario**: los PDFs de horario de grupo y de voluntario incluyen ahora logo y cabecera

### Mejorado

- **Importación de turnos de comida**: al importar un turno de comida, las coordenadas y dirección de la congregación coincidente se copian automáticamente en `activity_locations`; los mensajes de error del servidor (incluidos arrays de validación) se muestran correctamente en el modal de importación
- **PDFs de horario**: la columna Lugar queda vacía para turnos de comida, ya que la dirección aparece en el campo de descripción
- **Marcadores solapados distribuidos en espiral**: cuando varios grupos comparten las mismas coordenadas, los marcadores se distribuyen en espiral usando el ángulo dorado (137,5°) para que sean individualmente clicables; los marcadores grises y naranjas comparten el mismo contador de coordenadas para no solaparse entre sí
- **Columnas Roles y Activo en la plantilla de importación de voluntarios**: ambas columnas estaban soportadas por el parser pero no se incluían en la plantilla generada; Roles acepta nombres separados por coma; Activo acepta Sí/Si/yes/1/true
- **Límite por defecto de turnos de predicación corregido a 3**: `max_preaching_shifts_per_group` tenía un valor por defecto incorrecto de 4; se corrige a 3 en la migración, el servicio y los tests (el límite de actividades generales permanece en 4)

---

## [0.4.1] - 2026-06-27

### Añadido

- **Descarga de PDF de horario para voluntarios**: nuevo botón de descarga (visible solo en modo Planning) en la lista de voluntarios que genera el PDF de actividades y turnos del voluntario, idéntico al existente para grupos de anfitriones
- **Filtro por congregación en voluntarios**: nuevo desplegable en el panel de filtros de la lista de voluntarios que filtra por congregación asignada; al cambiar de región se actualiza automáticamente. Incluye opción "None" para mostrar solo voluntarios sin congregación asignada
- **Filtro por congregación en grupos de invitados**: mismo desplegable de congregación en la lista de grupos de invitados, con opción "None" para grupos sin congregación
- **Dropdown de borrado en grupos de invitados**: el botón "Truncate" ha sido reemplazado por un dropdown "Delete" (solo superadmin) con dos opciones: "Delete all" (equivalente al truncate anterior) y "Delete current filter" (elimina solo los grupos y sus invitados que coincidan con los filtros activos: región, búsqueda y/o congregación). Ambas opciones requieren escribir DELETE para confirmar. Nuevo endpoint `DELETE /api/guest-groups/delete-filtered`

### Mejorado

- **Tablas de planning a ancho completo con columnas equitativas**: las tablas de planificación semanal inline (tanto en grupos de invitados como en voluntarios) ahora ocupan todo el ancho disponible y reparten el espacio en columnas de igual anchura
- **MenuButtonComponent con variante danger**: el componente de menú desplegable acepta ahora `variant="danger"` para mostrar el botón con estilo rojo

---

## [0.4.0] - 2026-06-26

### Añadido

- **Vista de planificación semanal inline en grupos de anfitriones**: nuevo toggle en la cabecera del listado que oculta los botones de edición y muestra un calendario semanal colapsable bajo cada grupo, con columnas por día y filas por franja horaria; las actividades muestran badge de borrador/publicado. Carga perezosa por grupo con atajos de expandir/colapsar todo. Nuevo endpoint `GET /api/activities/group-schedule`
- **Vista de planificación semanal inline en voluntarios**: idéntica al calendario de grupos de anfitriones pero filtrada por voluntario. Nuevo endpoint `GET /api/activities/volunteer-schedule?volunteerId=`

- **Bloqueo de grupos de predicación con turno el mismo día**: el endpoint de grupos disponibles incluye ahora el campo `same_day_preaching_shift`, y el frontend deshabilita y etiqueta estos grupos tanto en el selector general como en el selector por grupo de predicación

### Mejorado

- **Grupos de anfitriones deshabilitados con 3 o más actividades normales**: el selector de grupos para un turno de predicación deshabilita los grupos que ya tienen 3 o más actividades normales asignadas, mostrando el motivo, en lugar de ocultarlos
- **Grupos con límite de predicación visibles pero deshabilitados**: en lugar de ocultar los grupos que han alcanzado el máximo de turnos de predicación o tienen conflicto en el mismo día, el selector los muestra deshabilitados con el motivo, para que los usuarios sepan por qué no están disponibles en lugar de pensar que no existen

### Corregido

- **Selector de grupos siempre visible en turnos de comida**: eliminada la condición `@if(guest_groups.length === 0)` que ocultaba el selector/botón de añadir grupo una vez se habían asignado grupos, impidiendo añadir más

---

## [0.3.0] - 2026-06-25

### Añadido

- **Importación/exportación Excel de actividades, turnos de predicación y turnos de comida**: los tres listados incluyen ahora dos dropdowns separados: **JSON** (solo Export JSON) y **Excel** (Export Excel · Download template), más un botón independiente **Import** (acepta `.json` y `.xlsx`). Al seleccionar un Excel el backend resuelve `region_name` → `region_id` y `host_name` → `host_id`, y las actividades resultantes pasan al paso de revisión y selección de secciones. Las filas con errores se muestran como advertencias sin bloquear las demás
- **Plantillas Excel por tipo de actividad**: la plantilla de cada sección omite las columnas `is_preaching_shift` / `is_food_shift` (su valor se fuerza automáticamente al importar según el contexto). La plantilla de Food Shifts sustituye `description` por tres columnas específicas (`host_person_name`, `host_person_address`, `host_person_phone`) que al importar generan automáticamente la descripción: `Estais invitados a comer en casa de {nombre} en {dirección}. Su tel. es {teléfono}.`
- Nuevos endpoints: `GET /activities/import/template`, `GET /activities/export/excel` y `POST /activities/import/parse-excel`
- **Congregación en voluntarios**: nuevo campo que vincula a cada voluntario con su congregación (host del sistema). La ficha del voluntario muestra el nombre, dirección, coordenadas y enlace a Google Maps de la congregación asignada. Es editable desde el modal de identidad con un selector con búsqueda filtrado por las regiones del voluntario. Importable y exportable mediante la columna "Congregación" del Excel (resuelve por nombre del host ignorando mayúsculas; si no hay coincidencia deja el campo vacío)
- **Distancia y congregación en el selector de voluntarios de actividad**: al asignar voluntarios a un grupo de predicación, cada voluntario muestra su distancia en km a la ubicación de la actividad (o al anfitrión como fallback) y el nombre de su congregación. Si el voluntario no tiene dirección propia pero sí congregación, la distancia se calcula desde las coordenadas de la congregación y aparece entre paréntesis junto al nombre de ésta
- **Selección múltiple de voluntarios en grupos de predicación**: el selector de voluntarios para añadir a un grupo de predicación admite ahora selección múltiple, permitiendo añadir varios voluntarios de una sola vez
- **Filtro por nombre en actividades**: nueva caja de búsqueda en la lista de actividades y turnos de predicación que filtra por nombre (búsqueda insensible a mayúsculas en backend)

### Mejorado

- **Filtros de actividades persistentes**: los filtros de la lista de actividades (región, anfitrión, estado, fecha, nombre) se guardan en `sessionStorage` para sobrevivir la navegación SPA; el botón "Clear" los resetea. Los filtros de turnos de predicación se guardan de forma independiente

### Corregido

- **is_food_shift no se enviaba al crear/actualizar actividades desde el import modal**: el payload de creación y actualización omitía el flag `is_food_shift`, por lo que los turnos de comida importados se guardaban como actividades generales

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
