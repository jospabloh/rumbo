import { useState } from 'react';
import { LifeBuoy, Command, Truck, Users, Wrench, Banknote, DollarSign, Bell, MessageSquare, MapPin, Shield, FileText, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import TicketForm from '@/components/support/TicketForm';
import { APP_VERSION } from '@/lib/version';
import { useEntityList } from '@/hooks/useEntities';
import { TICKET_STATUSES, TICKET_CATEGORIES, labelFor, statusColor } from '@/lib/support';

// Guía concisa por módulo (en español, igual que el resto de la app).
const GUIDE = [
  { icon: Users, title: 'Conductores', body: 'Da de alta a tu equipo con licencia, contacto y foto. Búscalos por nombre o licencia, edita su estatus y vincula su cuenta para que usen la App del Conductor.' },
  { icon: Truck, title: 'Vehículos', body: 'Administra la flotilla: placa/unidad, marca, modelo, odómetro y conductor asignado. El estatus (activo, mantenimiento, inactivo) alimenta el dashboard.' },
  { icon: Wrench, title: 'Taller', body: 'Registra mantenimientos (preventivo/correctivo) con costo y próxima fecha de servicio, y controla el inventario de refacciones. Genera alertas cuando un servicio está por vencer.' },
  { icon: Banknote, title: 'Rentas', body: 'Genera cobros por periodo, registra pagos y da seguimiento a ingresos y referidos. El dashboard muestra lo cobrado del día y la tendencia de 7 días.' },
  { icon: DollarSign, title: 'Financiero', body: 'Combustible, multas y reclamos de seguro en un solo lugar, más el cálculo de costo por kilómetro por vehículo.' },
  { icon: Bell, title: 'Alertas', body: 'Avisos automáticos por documentos, seguros, verificaciones o mantenimientos próximos a vencer. Fíltralas por severidad y márcalas como resueltas.' },
  { icon: MessageSquare, title: 'Mensajes', body: 'Canales de difusión y directos con tus conductores, con notas de voz y confirmaciones de lectura en tiempo real.' },
  { icon: MapPin, title: 'Ubicación', body: 'Solicita la ubicación de un conductor bajo demanda (sin rastreo continuo). El conductor la comparte una sola vez desde su app.' },
  { icon: FileText, title: 'Importar', body: 'Carga conductores o vehículos de forma masiva desde un archivo CSV, con vista previa antes de confirmar.' },
  { icon: Shield, title: 'Admin y permisos', body: 'Edita la marca de tu organización (logo y colores), invita usuarios, asigna roles y configura permisos por módulo para Dispatcher, Mecánico y Conductor.' },
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
      <PageHeader title="Centro de ayuda" subtitle="Guía de uso, atajos y soporte" />

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

      {/* Guía por módulo */}
      <h2 className="font-semibold text-sm mb-2 px-1">Guía por módulo</h2>
      <Accordion type="single" collapsible className="bg-card border border-border rounded-xl px-4">
        {GUIDE.map(({ icon: Icon, title, body }) => (
          <AccordionItem key={title} value={title}>
            <AccordionTrigger className="text-sm">
              <span className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 text-primary shrink-0" />
                {title}
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">{body}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <p className="text-xs text-muted-foreground mt-6 px-1">Rumbo · versión {APP_VERSION}</p>

      {showForm && <TicketForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
