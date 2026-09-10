import { useState } from 'react';
import { LifeBuoy, Command, MessageCircle, BookOpen, History, Mail, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import TicketForm from '@/components/support/TicketForm';
import ManualGuide from '@/components/help/ManualGuide';
import { APP_VERSION, RELEASE_DATE } from '@/lib/version';
import { SUPPORT_URL } from '@/lib/license';
import { useEntityList } from '@/hooks/useEntities';
import { TICKET_STATUSES, TICKET_CATEGORIES, labelFor, statusColor } from '@/lib/support';

// Mismo correo por defecto que usa submitTicket del lado servidor
// (Support_email / SUPPORT_EMAIL / APP_OWNER_EMAIL, ver USER_MANUAL.md) y que
// acaciaco-site usa para Soporte a Apps — no un valor nuevo inventado aquí.
const SUPPORT_EMAIL = 'soporte@acaciaco.com.mx';

// Plain-language digest of CHANGELOG.md, for end users -- not the raw
// technical entries. Update alongside a real CHANGELOG.md release; see the
// portfolio convention in cateqhub/liuma/puntos/radar/stockflow's own
// changelog surfaces.
const CHANGES = [
  {
    date: '2026-09-10',
    title: 'Un conductor recién unido ya ve su expediente',
    items: [
      'Corregido: un conductor que acababa de unirse a una organización podía ver "Tu expediente no está configurado aún" en su perfil, aunque ya estuviera correctamente vinculado. Si te pasó esto, vuelve a abrir la app: ya deberías ver tu expediente.',
    ],
  },
  {
    date: '2026-09-10',
    title: 'Unirte con un código ya no te regresa al inicio',
    items: [
      'Corregido: unirte a una organización con un código válido a veces mostraba "¡Te uniste!" y luego regresaba a la pantalla de elegir organización, como si no hubiera funcionado — aunque la unión sí había quedado guardada. Si te pasó esto, vuelve a abrir la app: ya deberías ver tu organización sin tener que repetir el código.',
    ],
  },
  {
    date: '2026-09-10',
    title: 'Invitar usuarios por correo, arreglado',
    items: [
      'Corregido: en Administración, invitar a alguien por correo fallaba con un error genérico ("Could not validate credentials") sin importar el correo o el rol elegido.',
      'Ahora, al invitar, la app ya no manda una invitación automática: agrega a la persona a tu organización y te dice el link de inicio de sesión para compartirle — ella entra por su cuenta (con Google o creando una contraseña, usando ese mismo correo) y la app la reconoce sola.',
    ],
  },
  {
    date: '2026-09-07',
    title: 'Correcciones internas y un campo que no hacía nada',
    items: [
      'Corregido: en Administración → editar organización, el campo "Email del owner" se podía editar pero el cambio nunca se guardaba (ese campo solo se puede cambiar desde "Delegar propiedad" en la Zona de Peligro, desde hace unas semanas). Ahora se muestra de solo lectura para no sugerir un cambio que no ocurre.',
      'Endurecidas varias funciones internas para que siempre lean tu perfil actualizado en vez de una copia que a veces podía quedarse desactualizada — sin cambios visibles para el uso normal de la app.',
    ],
  },
  {
    date: '2026-09-01',
    title: 'Cambiar de organización ya funciona',
    items: [
      'Corregido: si tu correo administra más de una organización, elegir otra en el selector ahora sí cambia. El guardado fallaba por completo y en silencio cuando la operación intentaba ajustar tu rol al mismo tiempo; ahora son dos pasos y el cambio de organización ya no depende del otro.',
      'El mismo problema afectaba a crear una organización, unirse con código, quitar a alguien de la organización y eliminarla — corregido en los cinco casos.',
    ],
  },
  {
    date: '2026-09-01',
    title: 'Corrección adicional al cambio de organización',
    items: [
      'Corregido un caso más del mismo problema de ayer: si perdías el acceso a tu única organización mientras tu cuenta estaba marcada como bloqueada, ese bloqueo podía no levantarse.',
    ],
  },
  {
    date: '2026-08-31',
    title: 'Cambiar de organización ahora sí funciona',
    items: [
      'Corregido: si tu correo administra más de una organización, elegir otra en el selector de organización ya cambia de verdad — antes la app volvía a mostrar la anterior después de recargar.',
    ],
  },
  {
    date: '2026-08-27',
    title: 'Cierre de sesión por inactividad y control de dispositivos',
    items: [
      'Nuevo: si no usas Rumbo por 20 minutos, aparece un aviso antes de cerrar tu sesión automáticamente; puedes elegir seguir trabajando.',
      'Nuevo: en Administración → Zona de Peligro, "Sesiones activas" muestra en qué dispositivos ha entrado tu cuenta y desde cuándo, con un botón para cerrar la sesión de cualquiera que no reconozcas.',
      'Las sesiones abandonadas (dispositivo apagado o sin conexión) ahora se cierran automáticamente después de 48 horas de inactividad.',
    ],
  },
  {
    date: '2026-08-26',
    title: 'Eliminar el tenant ahora borra los datos, no solo la licencia',
    items: [
      'Corregido: "Eliminar tenant" en la Zona de Peligro (solo owner) ahora borra vehículos, conductores, viajes y el resto de los datos operativos de la organización, no solo el registro de licencia. Los tickets de soporte se conservan como historial, y las cuentas de los usuarios no se borran, solo se desvinculan de la organización.',
      'Cada eliminación de tenant queda registrada como un ticket de soporte, con el detalle de qué se borró.',
    ],
  },
  {
    date: '2026-08-26',
    title: 'Contacto y créditos en el Centro de ayuda',
    items: [
      'Nuevo: un correo y un enlace directos a soporte, y una nota de que Rumbo es un producto de ACACIA Consultoría, en la parte de abajo de esta pantalla.',
    ],
  },
  {
    date: '2026-08-26',
    title: 'Inicio de sesión y mensajes de error',
    items: [
      'Quitamos "Continuar con Apple" de la pantalla de acceso: ese método no estaba habilitado y dejaba a quien lo intentaba sin poder crear su cuenta. Usa Google o correo y contraseña.',
      'Corregido: al editar o crear un registro, si la operación fallaba ahora se muestra el motivo real (permisos, licencia, etc.) en vez de un código de error genérico.',
      'Corregido: invitar a un usuario con rol Dispatcher, Mecánico, Conductor o Socio desde Administración ya no fallaba en silencio.',
    ],
  },
  {
    date: '2026-08-24',
    title: 'Zona de Peligro: delegar propiedad ahora es solo del owner',
    items: [
      'Corregido: un administrador ya no puede delegarse la propiedad del tenant a sí mismo ni, con eso, eliminarlo. Delegar propiedad y eliminar el tenant son ahora acciones exclusivas del owner actual.',
    ],
  },
  {
    date: '2026-08-19',
    title: 'Permisos y seguridad',
    items: [
      'Los permisos personalizados que un administrador asigna a un dispatcher o mecánico ahora se aplican también del lado del servidor, no solo en la pantalla.',
      'Nuevo: descargar todos los datos de tu flota desde la Zona de Peligro (Admin).',
    ],
  },
  {
    date: '2026-08-11',
    title: 'Auditoría de seguridad',
    items: [
      'Corregida una falla de seguridad en el registro de sesiones.',
    ],
  },
];

const badgeClasses = {
  warning: 'bg-warning/10 text-warning',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  muted: 'bg-muted text-muted-foreground',
};

function StatusBadge({ status }) {
  const color = statusColor(status);
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClasses[color] || badgeClasses.muted}`}>
      {labelFor(TICKET_STATUSES, status)}
    </span>
  );
}

export default function Help() {
  const [showForm, setShowForm] = useState(false);
  const { data: tickets = [] } = useEntityList('SupportTicket', { sort: '-last_activity_at' });

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <PageHeader title="Centro de ayuda" subtitle="Manual de uso, atajos y soporte" />

      {/* Soporte — CTA principal: abre un ticket real */}
      <div className="bg-card border border-border rounded-xl p-5 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <LifeBuoy className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm">¿Necesitas ayuda?</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Primero te sugerimos una sección del manual que podría resolverlo. Si aún necesitas ayuda, escalamos tu caso a soporte y te respondemos en un máximo de <span className="text-foreground font-medium">48 horas hábiles</span> por correo.
            </p>
            <div className="mt-3">
              <Button size="sm" className="gap-2" onClick={() => setShowForm(true)}>
                <LifeBuoy className="w-4 h-4" /> Abrir ticket de soporte
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mis solicitudes */}
      <div className="bg-card border border-border rounded-xl p-5 mb-5">
        <h2 className="font-semibold text-sm mb-3">Mis solicitudes</h2>
        {tickets.length === 0 ? (
          <EmptyState icon={MessageCircle} title="Sin tickets" description="Cuando abras un ticket de soporte aparecerá aquí con su estatus y respuestas." className="py-8" />
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => (
              <div key={t.id} className="border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium flex-1 min-w-0 truncate">{t.subject}</p>
                  <StatusBadge status={t.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {labelFor(TICKET_CATEGORIES, t.category)}
                  {t.last_activity_at ? ` · ${new Date(t.last_activity_at).toLocaleDateString()}` : ''}
                  {Array.isArray(t.responses) && t.responses.length > 0 ? ` · ${t.responses.length} respuesta${t.responses.length === 1 ? '' : 's'}` : ''}
                </p>
                {Array.isArray(t.responses) && t.responses.length > 0 && (
                  <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                    {t.responses.map((r, i) => (
                      <div key={i} className="text-xs">
                        <span className="font-medium text-primary">{r.author_name || 'Soporte'}:</span>{' '}
                        <span className="text-muted-foreground">{r.body}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Atajos / tips */}
      <div className="bg-card border border-border rounded-xl p-5 mb-5">
        <h2 className="font-semibold text-sm mb-3">Atajos y consejos</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <Command className="w-4 h-4 text-primary shrink-0" />
            Abre la paleta de comandos con <kbd className="font-mono text-xs px-1.5 py-0.5 rounded border border-border bg-secondary mx-1">⌘K</kbd> / <kbd className="font-mono text-xs px-1.5 py-0.5 rounded border border-border bg-secondary mx-1">Ctrl K</kbd> para saltar a cualquier sección.
          </li>
          <li>Personaliza el tema (claro/oscuro) y los colores de tu marca en <span className="text-foreground">Admin → Información de la organización</span>.</li>
          <li>Rumbo recuerda la última sección que visitaste y te regresa a ella al volver a entrar.</li>
        </ul>
      </div>

      {/* Manual de usuario */}
      <h2 className="font-semibold text-sm mb-2 px-1 flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-primary" /> Manual de usuario
      </h2>
      <p className="text-xs text-muted-foreground mb-3 px-1">Guía paso a paso de cada módulo. Usa el buscador para encontrar un proceso.</p>
      <ManualGuide />

      {/* Historial de cambios */}
      <h2 className="font-semibold text-sm mt-6 mb-2 px-1 flex items-center gap-2">
        <History className="w-4 h-4 text-primary" /> Historial de cambios
      </h2>
      <div className="space-y-3 mb-4">
        {CHANGES.map((c) => (
          <div key={c.date} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{c.date}</p>
            <p className="font-medium text-sm mb-1.5">{c.title}</p>
            <ul className="list-disc list-inside space-y-0.5">
              {c.items.map((i) => <li key={i} className="text-xs text-muted-foreground">{i}</li>)}
            </ul>
          </div>
        ))}
      </div>

      {/* Contacto y créditos — módulo 21 del estándar ACACIA: un correo y un
          canal directo que de verdad llegan a alguien (no el ticket de
          arriba otra vez, solo el camino más corto hacia él), más el
          reconocimiento de qué empresa está detrás de la app. */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" /> Contacto
        </h2>
        <div className="space-y-1.5 text-sm">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline underline-offset-2 block w-fit">
            {SUPPORT_EMAIL}
          </a>
          <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 block w-fit">
            acaciaco.com.mx/rumbo
          </a>
        </div>
        <div className="mt-4 pt-3 border-t border-border flex items-center gap-1.5 text-xs text-muted-foreground">
          <Heart className="w-3.5 h-3.5 text-destructive shrink-0" />
          Hecho con cariño para floteros y flotillas en México — un producto de ACACIA Consultoría.
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">© {new Date(RELEASE_DATE).getFullYear()} ACACIA Consultoría. Todos los derechos reservados.</p>
      </div>

      <p className="text-xs text-muted-foreground mt-6 px-1">Rumbo · versión {APP_VERSION} · {RELEASE_DATE}</p>

      {showForm && <TicketForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
