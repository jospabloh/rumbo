import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { MANUAL_SECTIONS } from '@/lib/manual';

/**
 * Manual de usuario in-app: secciones por módulo, cada una con temas y pasos
 * numerados. Incluye un buscador que filtra por título de sección/tema y un
 * acordeón para no abrumar. El contenido vive en `src/lib/manual.js`.
 */
function Topic({ topic }) {
  return (
    <div className="border-t border-border pt-3 first:border-0 first:pt-0">
      <p className="text-sm font-semibold text-foreground">{topic.title}</p>
      {topic.intro && <p className="text-sm text-muted-foreground mt-0.5">{topic.intro}</p>}
      {topic.steps?.length > 0 && (
        <ol className="mt-2 space-y-1.5 list-decimal pl-5">
          {topic.steps.map((s, i) => <li key={i} className="text-sm text-muted-foreground">{s}</li>)}
        </ol>
      )}
      {topic.notes?.length > 0 && (
        <ul className="mt-2 space-y-1">
          {topic.notes.map((n, i) => (
            <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
              <span className="text-primary shrink-0">•</span><span>{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ManualGuide() {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const sections = !query
    ? MANUAL_SECTIONS
    : MANUAL_SECTIONS
        .map((s) => {
          const sectionHit = s.title.toLowerCase().includes(query) || (s.intro || '').toLowerCase().includes(query);
          const topics = sectionHit
            ? s.topics
            : s.topics.filter((t) =>
                t.title.toLowerCase().includes(query) ||
                (t.intro || '').toLowerCase().includes(query) ||
                (t.steps || []).some((st) => st.toLowerCase().includes(query)),
              );
          return { ...s, topics };
        })
        .filter((s) => s.topics.length > 0);

  return (
    <div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el manual…" className="pl-9 bg-card border-border" />
      </div>

      {sections.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Sin resultados para “{q}”.</p>
      ) : (
        <Accordion type="single" collapsible className="bg-card border border-border rounded-xl px-4">
          {sections.map(({ id, title, icon: Icon, intro, topics }) => (
            <AccordionItem key={id} value={id}>
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2.5">
                  {Icon && <Icon className="w-4 h-4 text-primary shrink-0" />}
                  {title}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                {intro && <p className="text-sm text-muted-foreground mb-3">{intro}</p>}
                <div className="space-y-3">
                  {topics.map((t, i) => <Topic key={i} topic={t} />)}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
