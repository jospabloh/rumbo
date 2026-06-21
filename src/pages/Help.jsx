import { LifeBuoy, Mail, ExternalLink, Command, Truck, Users, Wrench, Banknote, DollarSign, Bell, MessageSquare, MapPin, Shield, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { SUPPORT_URL } from '@/lib/license';
import { APP_VERSION } from '@/lib/version';

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

export default function Help() {
  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <PageHeader title="Centro de ayuda" subtitle="Guía de uso, atajos y soporte" />

      {/* Soporte — CTA principal */}
      <div className="bg-card border border-border rounded-xl p-5 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <LifeBuoy className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm">¿Necesitas ayuda?</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Abre un ticket de soporte y nuestro equipo te responderá. Incluye tu organización y una breve descripción del problema.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="gap-2"><LifeBuoy className="w-4 h-4" /> Abrir ticket de soporte</Button>
              </a>
              <a href="mailto:soporte@acaciaco.com.mx?subject=Soporte%20Rumbo">
                <Button size="sm" variant="outline" className="gap-2"><Mail className="w-4 h-4" /> Escribir por correo</Button>
              </a>
            </div>
          </div>
        </div>
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

      <div className="flex items-center justify-between mt-6 px-1">
        <p className="text-xs text-muted-foreground">Rumbo · versión {APP_VERSION}</p>
        <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1">
          Sitio de soporte <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
