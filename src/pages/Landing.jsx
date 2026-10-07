import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Truck,
  Wrench,
  Banknote,
  ArrowRight,
  ShieldCheck,
  Bell,
  Gauge,
  ChevronRight,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Sitio de marketing / planes de Rumbo (gestionado por ACACIA).
const PRICING_URL = 'https://acaciaco.com.mx/rumbo';

export default function Landing() {
  // CTA principal: arranca el flujo de Rumbo (login / alta de organización).
  // Rumbo ya es un producto en operación, así que en lugar de una waitlist
  // mandamos al usuario a iniciar sesión y comenzar su prueba de 30 días.
  const startTrial = () => {
    try {
      base44.auth.redirectToLogin(globalThis.location?.href || '/');
    } catch {
      globalThis.location && (globalThis.location.href = '/');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="relative z-10 max-w-5xl mx-auto px-6 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-2 font-black text-lg">
          <img src="/rumbo.png" alt="Rumbo" className="w-9 h-9 rounded-xl object-cover" />
          Rumbo
        </div>
        <button
          type="button"
          onClick={startTrial}
          className="text-sm font-semibold text-foreground/80 hover:text-foreground px-3 py-2 rounded-xl hover:bg-card transition-colors"
        >
          Iniciar sesión
        </button>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-6 pt-12 pb-10 sm:pt-16 sm:pb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-5">
            <Truck className="w-3.5 h-3.5" />
            Gestión de flotillas · MX
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-foreground leading-[1.1] tracking-tight">
            Tu flotilla, <span className="text-primary">bajo control</span>.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
            Vehículos, conductores, rentas, mantenimiento, combustible y multas en un solo lugar.
            Sin hojas de cálculo, sin sorpresas.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={startTrial}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm play-press play-press--primary"
            >
              Comienza gratis
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href={PRICING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl border border-border bg-card text-foreground font-bold text-sm hover:bg-accent transition-colors"
            >
              Ver planes
            </a>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            30 días gratis con todas las funciones · sin tarjeta.
          </p>
        </div>
      </section>

      {/* Why */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <div className="grid sm:grid-cols-3 gap-3">
          <Card icon={Truck} title="Todo tu parque vehicular">
            Vehículos y conductores con sus documentos, vencimientos y asignaciones siempre a la mano.
          </Card>
          <Card icon={Wrench} title="Mantenimiento sin sorpresas">
            Taller, refacciones y servicios programados. Rumbo te avisa antes de que algo se vuelva un problema.
          </Card>
          <Card icon={Banknote} title="Rentas y finanzas claras">
            Rentas, combustible y multas en orden, con el costo por kilómetro de cada unidad.
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2">Cómo empezar</p>
          <h2 className="text-2xl sm:text-3xl font-black text-foreground mb-5">Operando en tres pasos.</h2>
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <Step n={1} title="Crea tu organización">30 días gratis, sin tarjeta. Tu logo y tus colores.</Step>
            <Step n={2} title="Carga tu flotilla">Agrega vehículos y conductores, o importa todo desde un CSV.</Step>
            <Step n={3} title="Controla y decide">Alertas, costos y rentas en un panel claro, desde el teléfono.</Step>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <div className="grid sm:grid-cols-3 gap-3">
          <Mini icon={Bell} title="Alertas de vencimientos">Licencias, seguros y verificaciones antes de que caduquen.</Mini>
          <Mini icon={Gauge} title="Costo por kilómetro">Sabe cuánto te cuesta realmente cada unidad.</Mini>
          <Mini icon={ShieldCheck} title="Cada flotilla aislada">Tus datos viven bajo tu organización, con permisos por rol.</Mini>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-20 max-w-3xl mx-auto">
        <div className="rounded-3xl border border-border bg-card divide-y divide-border">
          <FAQ q="¿Hay prueba gratis?">
            Sí. Al crear tu organización tienes 30 días con todas las funciones, sin tarjeta. Al terminar eliges
            un plan; si no pagas, tu cuenta pasa a solo lectura unos días antes de desactivarse (no pierdes tus datos).
          </FAQ>
          <FAQ q="¿Puedo cambiar de plan después?">
            Cuando quieras. Subes o bajas de plan según tu flotilla y los límites de vehículos y conductores se ajustan al instante.
          </FAQ>
          <FAQ q="¿Mis datos están seguros?">
            Cada organización está aislada y el acceso se controla con permisos por rol. Tú decides quién ve y edita qué.
          </FAQ>
        </div>
      </section>

      <footer className="px-6 pb-10 text-center text-[11px] text-muted-foreground">
        Rumbo · ACACIA Consultoría ·{' '}
        <a href={PRICING_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline-offset-2 hover:underline">
          acaciaco.com.mx/rumbo
        </a>{' '}
        · MX 2026
      </footer>
    </div>
  );
}

function Card({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <span className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
        <Icon className="w-4 h-4" />
      </span>
      <p className="font-bold text-sm text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{children}</p>
    </div>
  );
}

function Mini({ icon: Icon, title, children }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-muted/40 p-4">
      <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </span>
      <div>
        <p className="font-bold text-sm text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="rounded-2xl bg-muted/40 p-4">
      <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground font-black flex items-center justify-center text-xs mb-2">{n}</div>
      <p className="font-bold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{children}</p>
    </div>
  );
}

function FAQ({ q, children }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.details
      className="px-5 py-4 cursor-pointer"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="text-sm font-bold text-foreground list-none flex items-center justify-between">
        <span>{q}</span>
        <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
      </summary>
      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{children}</p>
    </motion.details>
  );
}
