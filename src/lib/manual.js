/**
 * Contenido del manual de usuario in-app (Centro de ayuda → Manual).
 *
 * Cada sección documenta un módulo con temas; cada tema tiene pasos numerados y
 * notas. Está en español, igual que la app, y los títulos de sección coinciden
 * con los que sugiere `suggestSolution` (src/lib/support.js) para que las
 * referencias de soporte apunten aquí.
 */
import {
  Rocket, Users, Truck, Wrench, Banknote, DollarSign, Bell, MessageSquare,
  MapPin, FileUp, List, Link2, CreditCard, Shield, Smartphone, LifeBuoy,
  SlidersHorizontal, Building2,
} from 'lucide-react';

export const MANUAL_SECTIONS = [
  {
    id: 'primeros-pasos',
    title: 'Primeros pasos',
    icon: Rocket,
    intro: 'Cómo crear tu organización o unirte a una existente, y qué incluye la prueba.',
    topics: [
      {
        title: 'Crear tu organización (prueba de 30 días)',
        steps: [
          'Al iniciar sesión por primera vez sin organización, en "¿Cómo quieres empezar?" elige "Crear mi organización".',
          'Paso 1: escribe el Nombre de la organización (obligatorio) y un Slogan opcional, y pulsa "Continuar".',
          'Paso 2: sube tu logo. Puedes "Extraer colores del logo con IA", elegir una paleta premium de un clic, o escribir los colores hex a mano (Principal, Secundario, Acento, Fondo).',
          'Pulsa "Finalizar". Se crea tu organización con 30 días gratis y todas las funciones.',
          'En la pantalla final se muestra tu código de unión: cópialo para invitar a tu equipo. Luego pulsa "Entrar a mi organización".',
        ],
        notes: [
          'Quien crea la organización queda como Owner (dueño).',
          'El código de unión también está siempre disponible en Admin.',
        ],
      },
      {
        title: 'Unirte a una organización existente',
        steps: [
          'En "¿Cómo quieres empezar?" elige "Unirme a una organización".',
          'Escribe el código de la organización (formato RUMBO-XXXXXX) que te compartió tu administrador y pulsa "Unirme".',
          'Entras con acceso de conductor; tu administrador puede ampliar tus permisos después.',
        ],
      },
    ],
  },
  {
    id: 'interfaz',
    title: 'Interfaz y apariencia',
    icon: SlidersHorizontal,
    intro: 'Temas, navegación rápida y detalles de la experiencia.',
    topics: [
      {
        title: 'Tema claro u oscuro',
        steps: [
          'Usa el selector de tema en el pie de la barra lateral (arriba de "Salir").',
          'Tu preferencia se recuerda en ese navegador. La app abre en modo oscuro por defecto.',
        ],
        notes: ['Los colores de tu marca (Admin) se aplican por encima de cualquier tema.'],
      },
      {
        title: 'Navegación rápida con la paleta de comandos',
        steps: [
          'Pulsa ⌘K (Mac) o Ctrl+K (Windows/Linux), o el botón "Buscar…" arriba de la barra lateral.',
          'Escribe el nombre de una sección para saltar a ella, o "tema" para cambiar claro/oscuro.',
        ],
        notes: ['La paleta sólo muestra secciones a las que tu rol tiene acceso.'],
      },
      {
        title: 'La app recuerda dónde estabas',
        steps: ['Al recargar o volver a entrar, Rumbo te regresa a la última sección que visitaste, no al inicio.'],
        notes: ['El menú izquierdo resalta la sección actual con una barra de acento.'],
      },
    ],
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: List,
    intro: 'Vista general de la operación con tarjetas accionables.',
    topics: [
      {
        title: 'Leer el tablero',
        steps: [
          'Arriba ves KPIs: vehículos activos, conductores, alertas abiertas, mensajes no leídos, ingresos del día, por cobrar, disponibilidad y flota total.',
          'Cada tarjeta es un acceso directo: tócala para ir a su sección (p. ej. "Vehículos activos" abre el catálogo de vehículos).',
          'La gráfica "Ingresos · últimos 7 días" muestra la tendencia de cobros de rentas.',
          'Abajo: estado de la flotilla y alertas recientes.',
        ],
      },
      {
        title: 'Acciones rápidas',
        steps: [
          'Bajo el título hay botones que abren directamente el formulario de alta: "Agregar vehículo", "Agregar conductor", "Registrar mantenimiento".',
          'Sólo aparecen las acciones permitidas para tu rol y se ocultan si la licencia está en solo lectura.',
        ],
      },
    ],
    notes: ['Acceso: Owner, Admin, Dispatcher. Otros roles llegan a su primera sección disponible.'],
  },
  {
    id: 'conductores',
    title: 'Conductores',
    icon: Users,
    intro: 'Alta y gestión del padrón de conductores y vinculación con la app del conductor.',
    topics: [
      {
        title: 'Agregar un conductor',
        steps: [
          'Entra a "Conductores" y pulsa "Agregar".',
          'Captura el Nombre completo (obligatorio). Opcionales: teléfono, No. de licencia, vencimiento de licencia, fecha de contratación, fecha de antecedentes, calificación (0 a 5) y referido por (otro conductor).',
          'Sube la foto y documentos (licencia, INE, comprobante de domicilio) si los tienes.',
          'Elige el estatus (Activo, Suspendido, Inactivo) y pulsa "Guardar".',
        ],
        notes: ['La validación marca errores debajo de cada campo (p. ej. calificación fuera de 0–5).'],
      },
      {
        title: 'Buscar, ver y editar',
        steps: [
          'Usa el buscador por nombre o licencia.',
          'Toca un conductor para ver su detalle: documentos, notas y vinculación con la app.',
          'Desde el detalle puedes Editar o Eliminar el registro.',
        ],
      },
      {
        title: 'Vincular un conductor con la App del Conductor',
        steps: [
          'Primero invita al conductor en Admin → Usuarios → Invitar (con su correo y rol Conductor).',
          'Cuando inicie sesión, ve al detalle del conductor y vincula su cuenta de app.',
          'A partir de ahí el conductor usa la interfaz simplificada /driver.',
        ],
      },
    ],
    notes: ['Acceso: Owner, Admin, Dispatcher. El límite de conductores depende de tu plan.'],
  },
  {
    id: 'vehiculos',
    title: 'Vehículos',
    icon: Truck,
    intro: 'Gestión de la flotilla, documentos, asignación de conductor y configuración de renta.',
    topics: [
      {
        title: 'Agregar un vehículo',
        steps: [
          'Entra a "Vehículos" y pulsa "Agregar".',
          'Captura Placa o No. de unidad (al menos uno es obligatorio), marca, modelo, año (1900–2100) y VIN.',
          'Asigna un conductor y el odómetro actual si aplica.',
          'Registra vencimientos: seguro, verificación/inspección, tarjeta de circulación/registro y holograma (alimentan las alertas).',
          'Configura la renta: monto, frecuencia (semanal o diaria) y día de cobro.',
          'Elige el estatus (Activo, Mantenimiento, Inactivo) y pulsa "Guardar".',
        ],
      },
      {
        title: 'Buscar, ver detalle y documentos',
        steps: [
          'Busca por placa, marca o modelo.',
          'Abre un vehículo para ver documentos, historial de mantenimiento y conductor asignado.',
          'Desde el detalle puedes Editar o Eliminar.',
        ],
      },
    ],
    notes: ['Acceso: Owner, Admin, Dispatcher, Mecánico (lectura/edición según permisos). El límite de vehículos depende de tu plan.'],
  },
  {
    id: 'taller',
    title: 'Taller',
    icon: Wrench,
    intro: 'Mantenimientos del vehículo e inventario de refacciones con alertas de stock bajo.',
    topics: [
      {
        title: 'Registrar un mantenimiento',
        steps: [
          'Entra a "Taller", pestaña "Mantenimientos", y pulsa "Registrar".',
          'Elige el vehículo y el tipo (preventivo o correctivo).',
          'Captura descripción, odómetro, costo, fecha realizada y próxima fecha de servicio.',
          'Adjunta una foto si aplica y pulsa "Guardar".',
        ],
        notes: ['Si la próxima fecha está dentro de 14 días, se genera una alerta automáticamente.'],
      },
      {
        title: 'Inventario de refacciones',
        steps: [
          'En "Taller" abre la pestaña "Inventario".',
          'Pulsa "Agregar repuesto" y captura nombre (obligatorio), marca, SKU, No. de unidad, costo unitario, stock y stock mínimo.',
          'Ajusta existencias con los botones − y + en cada renglón.',
          'Toca el nombre de una refacción para editarla.',
        ],
        notes: [
          'Si el stock llega a su mínimo aparece la etiqueta "Stock bajo"; en 0, "Agotado".',
          'Al generar alertas, las refacciones bajo su mínimo crean una alerta (crítica si están en 0).',
        ],
      },
    ],
    notes: ['Acceso: Owner, Admin, Mecánico.'],
  },
  {
    id: 'rentas',
    title: 'Rentas',
    icon: Banknote,
    intro: 'Cobros por periodo, registro de pagos, cargos manuales, ingresos y referidos.',
    topics: [
      {
        title: 'Generar cobros del periodo',
        steps: [
          'Entra a "Rentas", vista "Cobros", y pulsa "Generar cobros del período".',
          'Se crean los cargos según la renta de cada vehículo (monto, frecuencia semanal/diaria y día de cobro).',
          'Filtra los cargos con las pestañas: Todos, Pendientes, Parciales, Vencidos, Pagados; o busca por unidad/conductor.',
        ],
        notes: ['Arriba ves los KPIs: Cobrado hoy, Por cobrar y Choferes con adeudo.'],
      },
      {
        title: 'Registrar un pago',
        steps: [
          'En la tarjeta del cargo pulsa "Pago".',
          'En "Registrar pago" captura el Monto recibido ($), elige el Método (efectivo, transferencia, etc.) y una Nota opcional.',
          'Pulsa "Registrar"; el saldo pendiente se actualiza y el pago del día se refleja en "Ingresos hoy" del dashboard.',
        ],
      },
      {
        title: 'Cobro manual y otras vistas',
        steps: [
          'Pulsa "Cobro manual" para un cobro fuera del periodo: elige Unidad, fechas Inicio y Fin, y el Monto de la renta ($); luego "Crear cobro".',
          'La vista "Ingresos" resume lo cobrado; la vista "Referidos" da seguimiento a conductores referidos.',
        ],
      },
    ],
    notes: ['Acceso: Owner, Admin, Dispatcher.'],
  },
  {
    id: 'financiero',
    title: 'Financiero',
    icon: DollarSign,
    intro: 'Combustible, multas, reclamos de seguro y costo por kilómetro.',
    topics: [
      {
        title: 'Registrar combustible',
        steps: [
          'Entra a "Financiero" y registra un consumo de combustible.',
          'Elige el vehículo (obligatorio) y conductor; captura litros, precio por litro, costo total y odómetro.',
          'Adjunta el ticket si lo tienes y guarda.',
        ],
        notes: ['Las pestañas del módulo son Multas, Seguros y Costo/km.'],
      },
      {
        title: 'Registrar una multa',
        steps: [
          'En la pestaña "Multas" pulsa "Registrar".',
          'Elige Conductor y Vehículo (obligatorios), Tipo de infracción, Monto ($) (mayor a 0), Puntos y Fecha.',
          'Marca "Ya pagada" si corresponde, adjunta foto y guarda.',
        ],
      },
      {
        title: 'Reclamos de seguro',
        steps: [
          'En la pestaña de seguros, agrega un reclamo.',
          'Elige el vehículo (obligatorio) y conductor; captura descripción, monto del reclamo, fecha del incidente y estatus (abierto, aprobado, rechazado, cerrado).',
        ],
      },
      {
        title: 'Costo por kilómetro',
        steps: [
          'Abre la herramienta de costo por km.',
          'El sistema combina combustible, mantenimiento y multas por vehículo y calcula el costo por kilómetro recorrido.',
        ],
        notes: ['Requiere suficientes registros de combustible con lecturas de odómetro.'],
      },
    ],
    notes: ['Acceso: Owner, Admin. El costo por km también para Dispatcher.'],
  },
  {
    id: 'alertas',
    title: 'Alertas',
    icon: Bell,
    intro: 'Avisos automáticos por vencimientos y stock; cómo filtrarlos y resolverlos.',
    topics: [
      {
        title: 'Entender las alertas',
        steps: [
          'Se generan cuando documentos, seguros, verificaciones, registros o mantenimientos están por vencer (30 días; 14 para mantenimiento), y por refacciones con stock bajo.',
          'Severidad: Crítica (≤3 días), Aviso (≤15 días), Info (≤30 días).',
        ],
      },
      {
        title: 'Filtrar, resolver y generar',
        steps: [
          'Usa las pestañas para filtrar por severidad (Todas, Críticas, Avisos).',
          'Pulsa el ícono de palomita para marcar una alerta como resuelta.',
          'Pulsa "Verificar ahora" para generar alertas manualmente en ese momento.',
        ],
      },
    ],
    notes: ['Acceso: Owner, Admin, Dispatcher.'],
  },
  {
    id: 'mensajes',
    title: 'Mensajes',
    icon: MessageSquare,
    intro: 'Mensajería por canales con conductores, incluyendo notas de voz.',
    topics: [
      {
        title: 'Crear un canal',
        steps: [
          'Entra a "Mensajes" y pulsa el "+" junto a "Canales".',
          'En "Tipo" elige "Broadcast (todos los conductores)" o "Directo (1 conductor)".',
          'Escribe el "Nombre del canal" y, si es directo, elige el conductor; pulsa "Crear canal".',
        ],
      },
      {
        title: 'Enviar mensajes y notas de voz',
        steps: [
          'Selecciona un canal, escribe tu mensaje y pulsa enviar (o Enter).',
          'Para una nota de voz, mantén presionado el botón del micrófono mientras hablas y suéltalo para enviar.',
        ],
        notes: ['Los mensajes muestran estado Enviado / Entregado / Leído. El conteo de no leídos aparece en la barra lateral.'],
      },
    ],
    notes: ['Acceso: Owner, Admin, Dispatcher y Conductores (en sus canales).'],
  },
  {
    id: 'ubicacion',
    title: 'Ubicación',
    icon: MapPin,
    intro: 'Solicitud de ubicación bajo demanda, sin rastreo continuo.',
    topics: [
      {
        title: 'Solicitar la ubicación de un conductor',
        steps: [
          'Entra a "Ubicación"; en "Solicitar ubicación" usa "Seleccionar vehículo" y pulsa "Solicitar".',
          'El conductor recibe un aviso en su app; cuando comparte, su ubicación aparece en el mapa.',
          'El historial muestra cada solicitud como "Esperando respuesta", "Ubicación recibida" o "Expirada".',
        ],
      },
      {
        title: 'Responder (conductor)',
        steps: [
          'El conductor ve el aviso "El dispatcher solicita tu ubicación" en su Inicio.',
          'Pulsa "Compartir": se envía su ubicación una sola vez, sin rastreo.',
        ],
      },
    ],
    notes: ['Acceso: Owner, Admin, Dispatcher (solicitan); Conductores (responden).'],
  },
  {
    id: 'importar',
    title: 'Importar',
    icon: FileUp,
    intro: 'Carga masiva desde CSV con validación por fila: conductores, vehículos, combustible, multas, mantenimientos, refacciones y listas de catálogo.',
    topics: [
      {
        title: 'Importar un archivo CSV',
        steps: [
          'Entra a "Importar" y elige el tipo: Conductores, Vehículos, Combustible, Multas, Mantenimientos, Seguros, Rentas, Refacciones o Catálogos.',
          'Descarga la plantilla para ver las columnas exactas y llénala (admite comillas, comas dentro de comillas y saltos de línea).',
          'Sube el archivo. Rumbo separa las filas válidas (con vista previa) de las que tienen problemas (listadas con su número de línea y motivo).',
          'Pulsa "Importar … registros válidos". Sólo se importan las filas válidas.',
        ],
        notes: [
          'Conductores requieren "nombre"; vehículos requieren "placa" o "no_unidad".',
          'Combustible, multas, mantenimientos, seguros y rentas se enlazan a un vehículo existente por "placa" y a un conductor por "conductor" (su licencia o su nombre exacto). Si la placa/conductor no existe en tu flota, esa fila se marca con error para que la corrijas — no se crean registros incompletos.',
          'En Rentas puedes indicar el monto ya pagado; el saldo y el estatus (pendiente/parcial/pagado) se calculan solos (los pagos individuales se registran luego en la sección Rentas).',
          'La importación es fila por fila: si una falla al guardar, las demás continúan y el resumen indica importadas/omitidas/fallidas.',
        ],
      },
    ],
    notes: ['Acceso: Owner, Admin.'],
  },
  {
    id: 'catalogos',
    title: 'Listas',
    icon: List,
    intro: 'Listas configurables que alimentan los desplegables de los formularios (en el menú: Configuración → Listas).',
    topics: [
      {
        title: 'Administrar listas',
        steps: [
          'Entra a "Listas" (menú Configuración) y elige la categoría: tipos de infracción, métodos de pago, marcas de vehículo, tipos de servicio (taller) o aseguradoras.',
          'Agrega elementos, actívalos/desactívalos o elimínalos.',
        ],
        notes: ['Si no defines elementos, se usan valores por defecto.'],
      },
    ],
    notes: ['Acceso: Owner, Admin.'],
  },
  {
    id: 'enlaces',
    title: 'Enlaces útiles',
    icon: Link2,
    intro: 'Accesos directos a sistemas externos de tu organización.',
    topics: [
      {
        title: 'Agregar un enlace',
        steps: [
          'Entra a "Enlaces útiles" y pulsa "Agregar".',
          'Captura nombre y URL (obligatorios) y una descripción opcional; guarda.',
          'Cualquier miembro verá los enlaces activos; admin/owner pueden editarlos o eliminarlos.',
        ],
      },
    ],
  },
  {
    id: 'licencia',
    title: 'Mi licencia',
    icon: CreditCard,
    intro: 'Tu plan, uso, límites y estado de la licencia (en el menú: Configuración → Mi licencia).',
    topics: [
      {
        title: 'Consultar plan y uso',
        steps: [
          'Entra a "Mi licencia" (menú Configuración) para ver tu plan (Trial, Starter, Pro, Enterprise) y estado.',
          'Revisa el uso de vehículos y conductores contra los límites de tu plan y los días restantes.',
        ],
        notes: [
          'Límites por plan: Trial 5/5, Starter 15/20, Pro 50/75, Enterprise ilimitado.',
          'Estados de licencia: Activa, Pago pendiente (gracia), Solo lectura y Desactivada.',
        ],
      },
      {
        title: 'Renovar',
        steps: ['Contacta a ventas/soporte para renovar o mejorar tu plan; el owner de la app confirma el pago y extiende la vigencia.'],
      },
    ],
    notes: ['Acceso: Owner, Admin.'],
  },
  {
    id: 'admin',
    title: 'Admin y permisos',
    icon: Shield,
    intro: 'Marca de la organización, usuarios, permisos por rol, código de unión y zona de peligro.',
    topics: [
      {
        title: 'Marca: logo y colores',
        steps: [
          'Entra a "Admin" → Información de la organización y pulsa "Editar".',
          'Sube el logo (SVG/PNG/JPG) o pega una URL; al subirlo se sugieren colores con IA.',
          'Elige una paleta premium de un clic o ajusta los colores hex (principal, secundario, acento, fondo).',
          'Guarda; los colores se aplican de inmediato en toda la app.',
        ],
      },
      {
        title: 'Usuarios e invitaciones',
        steps: [
          'En "Usuarios" ves a todos los miembros; toca el rol de un usuario para cambiarlo (no puedes cambiar el tuyo).',
          'Usa "Invitar" para enviar una invitación por correo con un rol asignado.',
          'Comparte el código de unión para que tu equipo se una.',
        ],
      },
      {
        title: 'Permisos por rol',
        steps: [
          'En "Permisos por rol", la pestaña Admin se muestra con todo habilitado (no configurable).',
          'Elige un rol configurable (Dispatcher, Mecánico o Conductor).',
          'Activa o desactiva cada permiso por módulo/acción (ver, crear, editar, eliminar, pausar) y pulsa "Guardar cambios".',
        ],
        notes: ['Los permisos nuevos llegan en modo solo lectura hasta que el admin otorgue más.'],
      },
      {
        title: 'Zona de peligro',
        steps: [
          'Delegar propiedad: transfiere el rol de owner a otro usuario por su correo.',
          'Eliminar organización: borra todo de forma permanente; escribe ELIMINAR para confirmar.',
        ],
      },
    ],
    notes: ['Acceso: Owner, Admin.'],
  },
  {
    id: 'app-conductor',
    title: 'App del conductor',
    icon: Smartphone,
    intro: 'Interfaz simplificada para conductores en /driver.',
    topics: [
      {
        title: 'Inicio y compartir ubicación',
        steps: [
          'En "Inicio" el conductor ve su vehículo asignado, calificación y alertas.',
          'Si hay una solicitud de ubicación, pulsa "Compartir" para enviarla una sola vez.',
        ],
      },
      {
        title: 'Registrar un viaje',
        steps: [
          'Entra a "Viajes" y pulsa "Registrar".',
          'Elige plataforma (Uber, DiDi, Particular), fecha, ingresos y distancia; guarda.',
          'Arriba se muestran los totales: viajes, ingresos y kilómetros.',
        ],
        notes: ['Se necesita un vehículo asignado para registrar viajes.'],
      },
      {
        title: 'Perfil',
        steps: [
          'En "Perfil" el conductor ve sus datos y vehículo asignado.',
          'Pulsa "Editar" para actualizar su propio teléfono. Los demás datos los gestiona un administrador.',
        ],
      },
    ],
  },
  {
    id: 'soporte',
    title: 'Soporte y ayuda',
    icon: LifeBuoy,
    intro: 'Cómo obtener ayuda: primero el manual, luego escalamiento a soporte.',
    topics: [
      {
        title: 'Abrir un ticket de soporte',
        steps: [
          'En el Centro de ayuda pulsa "Abrir ticket de soporte".',
          'Captura asunto, categoría, prioridad y una descripción detallada; pulsa "Buscar solución".',
          'Rumbo te sugiere una sección del manual que podría resolverlo. Si te sirvió, ciérralo; si no, pulsa "Escalar a soporte".',
          'Verás la confirmación de que tu caso fue escalado y que responderemos en un máximo de 48 horas hábiles (también por correo).',
        ],
      },
      {
        title: 'Mis solicitudes',
        steps: ['En el Centro de ayuda, "Mis solicitudes" muestra tus tickets con su estatus y las respuestas del equipo de soporte.'],
      },
    ],
    notes: ['Acceso: todos los roles, incluido el conductor.'],
  },
  {
    id: 'plataforma',
    title: 'Plataforma (owner de la app)',
    icon: Building2,
    intro: 'Funciones exclusivas del administrador de la aplicación.',
    topics: [
      {
        title: 'Licencias',
        steps: [
          'En "Licencias" ves todas las organizaciones, su estado y uso.',
          'Renueva (mensual/anual), cambia el estatus o ajusta el plan.',
        ],
      },
      {
        title: 'Bandeja de soporte',
        steps: [
          'En "Soporte" ves todos los tickets de todas las organizaciones.',
          'Filtra por estatus, cambia el estatus (abierto, en proceso, resuelto, cerrado) y responde.',
          'Cada respuesta se envía por correo al solicitante.',
        ],
      },
    ],
    notes: ['Acceso: sólo el owner de la app.'],
  },
];
