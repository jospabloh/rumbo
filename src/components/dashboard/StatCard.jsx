import { Link } from 'react-router-dom';

// Módulo 27: el ícono va en una ficha sólida con relieve (el color dice qué
// tipo de cifra es) y la cifra en la tipografía de títulos. La tarjeta en sí
// se queda neutra: con ocho fichas de color lleno el tablero gritaría.
const colorMap = {
  blue: 'bg-primary text-primary-foreground play-press--primary',
  green: 'bg-success text-white [--play-fill:hsl(var(--success))]',
  red: 'bg-destructive text-destructive-foreground play-press--danger',
  purple: 'bg-violet-500 text-white [--play-fill:theme(colors.violet.500)]',
  yellow: 'bg-warning text-warning-foreground [--play-fill:hsl(var(--warning))]',
  gray: 'bg-muted text-muted-foreground play-press--neutral',
};

export default function StatCard({ icon: Icon, label, value, sub, color = 'blue', link = null }) {
  const card = (
    <div className="bg-card border-2 border-border rounded-2xl p-4 flex flex-col gap-3 play-card h-full">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center play-press ${colorMap[color] || colorMap.blue}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-display font-extrabold tracking-tight tabular-nums">{value}</p>
        <p className="text-xs font-bold text-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  if (link) return <Link to={link} className="block play-lift-hover rounded-2xl">{card}</Link>;
  return card;
}
