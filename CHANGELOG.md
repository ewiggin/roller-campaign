# Changelog

## [0.2.5] - 2026-06-18

### Añadido
- **Exportación e importación de actividades** con UI de merge para resolver conflictos al importar
- **Comprobación de versión en el escritorio**: la app avisa con un toast cuando hay una versión más reciente disponible para descargar
- **Importación de anfitriones con días de reunión**: el proceso de importación ahora acepta y aplica los días de reunión de cada anfitrión
- **Mejoras en la importación de grupos**: flujo de importación más robusto con nuevos DTOs de validación, respuesta de parseo y commit

### Corregido
- El toast de nueva versión ahora solo se muestra cuando la versión remota es estrictamente más nueva que la local
