# Carritos se van de vacaciones - Formularios

Este proyecto es un formulario sin backend que debe conectarse a Google Docs para poder leer y escribir un Google Sheet.

## Tecnologia de frontend

El formulario debe ser construido con:

- Angular
- CSS con tailwindcss

## Base de datos

- Google Sheet utilizando Apps Script de un documento ya existente, con las siguiente columnas:
  - Número de identificación,Nombre,Sexo,Estado civil,Congregación,Sucursal,Tiene asignado un turno,Grupos,Horas asignadas
  - Se deberán añadir las columnas correspondientes al final de la hoja
  - La columna de turnos debería ser por cada día de la semana - mañana y tarde, por lo tanto serían 14 columnas para los turnos

## Los campos que debe pedir el formulario son:

- Código de voluntario
- Número de plazas disponibles en tu coche
- Congregación
- Disponibilidad de turnos: Qué disponibilidad horaria tiene de lunes a domingo (Una tabla de lunes a domingo con dos filas, mañana y tarde que pueden ser seleccionadas ambas)

