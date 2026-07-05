import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { BookOpen, CheckCircle2, LifeBuoy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FormError } from '@/components/ui/form-error';
import ResponsiveModal from '@/components/ui/responsive-modal';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, validateTicket, suggestSolution, SUPPORT_SLA_HOURS } from '@/lib/support';
import { composeTicketBody } from '@/lib/aiIntake';
import AiIntakeChat from '@/components/support/AiIntakeChat';
import { useInvalidateEntity } from '@/hooks/useEntities';

// Categorías donde entra el asistente BA/PO experto: nueva funcionalidad (feature)
// e incidencias (bug). El resto (dudas, facturación, otro) conserva el desvío
// directo al manual — no necesita levantar requisitos.
const AI_CATEGORIES = new Set(['feature', 'bug']);

/**
 * Formulario de soporte:
 *  1. form        — el usuario describe su solicitud.
 *  2a. ai         — (feature / incidencia) un BA/PO experto entrevista al usuario
 *                   y arma un brief accionable para el desarrollador.
 *  2b. suggestion — (resto) le mostramos la sección del manual que podría resolverlo.
 *  3. done        — escalamos a soporte y confirmamos el SLA de 48 h hábiles.
 *
 * @param {{ onClose: () => void }} props
 */
export default function TicketForm({ onClose }) {
  const invalidate = useInvalidateEntity();
  const [step, setStep] = useState('form');
  const [form, setForm] = useState({ subject: '', body: '', category: 'question', priority: 'normal' });
  const [suggestion, setSuggestion] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [folio, setFolio] = useState('');

  const usesAi = AI_CATEGORIES.has(form.category);

  const review = () => {
    const validation = validateTicket(form);
    if (validation) { setError(validation); return; }
    setError('');
    if (usesAi) {
      setStep('ai');
      return;
    }
    setSuggestion(suggestSolution(form.category, `${form.subject} ${form.body}`));
    setStep('suggestion');
  };

  /**
   * Escala el ticket. Si viene un `brief` de la IA, el cuerpo se enriquece con la
   * especificación en Markdown (para que llegue a todos lados) y se adjunta el
   * brief estructurado en `ai_brief` (render enriquecido en Mission Control).
   */
  const escalate = async (brief) => {
    setSaving(true);
    setError('');
    try {
      /** @type {Record<string, any>} */
      const payload = {
        ...form,
        suggested_section: suggestion?.section,
      };
      if (brief) {
        payload.body = composeTicketBody(form.body, brief);
        payload.ai_brief = brief;
      }
      const res = await base44.functions.invoke('submitTicket', payload);
      const data = res?.data || res;
      if (data?.error) { setError(data.error); setSaving(false); return; }
      setFolio(data?.ticket?.ticket_number || '');
      invalidate('SupportTicket');
      setStep('done');
    } catch {
      setError('No se pudo enviar el ticket. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const title = step === 'done'
    ? 'Solicitud escalada'
    : step === 'ai'
      ? (form.category === 'bug' ? 'Reporte de incidencia' : 'Nueva funcionalidad')
      : step === 'suggestion' ? 'Posible solución' : 'Abrir ticket de soporte';

  return (
    <ResponsiveModal title={title} onClose={onClose} maxWidth="md">
      {step === 'form' && (
        <div className="space-y-3">
          <div>
            <Label>Asunto *</Label>
            <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className="mt-1 bg-background" placeholder="Ej. No puedo registrar un cobro" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoría</Label>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
                {TICKET_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Prioridad</Label>
              <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm">
                {TICKET_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>Describe tu solicitud *</Label>
            <Textarea value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} className="mt-1 bg-background min-h-28" placeholder="Cuéntanos qué pasó, en qué pantalla y qué esperabas que sucediera." />
          </div>
          {usesAi && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              Un asistente experto te hará unas preguntas para dejar tu solicitud lista para el equipo.
            </p>
          )}
          <FormError>{error}</FormError>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button onClick={review} className="flex-1 gap-2">
              {usesAi ? <><Sparkles className="w-4 h-4" /> Continuar con el asistente</> : <><BookOpen className="w-4 h-4" /> Buscar solución</>}
            </Button>
          </div>
        </div>
      )}

      {step === 'ai' && (
        <AiIntakeChat
          kind={form.category === 'bug' ? 'bug' : 'feature'}
          subject={form.subject}
          description={form.body}
          saving={saving}
          onBack={() => { setError(''); setStep('form'); }}
          onComplete={(brief) => escalate(brief)}
        />
      )}

      {step === 'suggestion' && (
        <div className="space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <BookOpen className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Antes de escalar, revisa el manual</p>
            </div>
            <p className="text-sm text-muted-foreground">{suggestion?.tip}</p>
            <p className="text-sm mt-2">
              Sección sugerida: <span className="font-medium text-foreground">{suggestion?.section}</span>
              <span className="text-muted-foreground"> — revísala en el Centro de ayuda.</span>
            </p>
          </div>
          <FormError>{error}</FormError>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={onClose} className="gap-2"><CheckCircle2 className="w-4 h-4" /> Esto resolvió mi problema</Button>
            <Button onClick={() => escalate()} disabled={saving} className="gap-2"><LifeBuoy className="w-4 h-4" /> {saving ? 'Escalando...' : 'Aún necesito ayuda — escalar a soporte'}</Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="text-center py-2">
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6 text-success" />
          </div>
          <p className="font-semibold">Tu solicitud fue escalada a soporte</p>
          {folio && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              Folio: {folio}
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            Te responderemos dentro de las próximas <span className="text-foreground font-medium">{SUPPORT_SLA_HOURS} horas hábiles</span>. Enviamos una copia a tu correo{folio ? ` con tu folio ${folio}` : ''}.
          </p>
          {suggestion?.section && (
            <p className="text-xs text-muted-foreground mt-2">Mientras tanto, revisa la sección «{suggestion.section}» en la Guía por módulo.</p>
          )}
          <Button onClick={onClose} className="mt-4 w-full">Entendido</Button>
        </div>
      )}
    </ResponsiveModal>
  );
}
