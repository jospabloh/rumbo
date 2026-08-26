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
