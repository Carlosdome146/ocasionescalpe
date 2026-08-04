OCASIONES CALPE · WEB MULTIPÁGINA
====================================

PÁGINAS
- index.html: portada.
- catalogo.html: catálogo con buscador y filtros.
- producto.html?id=1: ficha individual de producto.
- montaje.html: explicación del servicio de montaje.
- tienda.html: información sobre el negocio.
- contacto.html: datos de contacto y formulario hacia WhatsApp.

CÓMO ABRIRLA
Abre index.html en el navegador. Para probar mejor la navegación entre páginas, se recomienda subir toda la carpeta a un alojamiento web o iniciar un servidor local.

ACTUALIZAR PRODUCTOS
Edita products.js. Cada producto tiene:
- id: número único.
- name: nombre.
- category: muebles, electrodomesticos, descanso o jardin.
- categoryLabel: nombre visible.
- image: ruta de la fotografía.
- price: precio o “Consultar”.
- condition: estado.
- mounting: included, optional o none.
- mountingLabel: texto visible del montaje.
- description: descripción.
- details: medidas, color, disponibilidad, etc.

Para usar fotos reales, guárdalas en la carpeta assets y cambia el campo image. Ejemplo:
image: "assets/sofa-gris-01.jpg"

DATOS A REVISAR ANTES DE PUBLICAR
- Teléfono / WhatsApp: actualmente 607 226 579.
- Dirección: actualmente Av. Valencia, 3, Calpe.
- Textos del catálogo y fotos reales.
- Condiciones exactas del montaje.

FORMULARIO
El formulario no necesita servidor: abre WhatsApp con el mensaje preparado. Para recibir correos o guardar consultas en una base de datos habría que conectar un servicio de formularios o un backend.

PUBLICACIÓN
Sube todos los archivos y la carpeta assets a Netlify, Vercel, GitHub Pages o al hosting del dominio. El archivo principal debe seguir llamándose index.html.
