# Changelog

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
