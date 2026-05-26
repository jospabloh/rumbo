import { Link } from 'react-router-dom';

const colorMap = {
  blue: 'text-primary bg-primary/10',
  green: 'text-success bg-success/10',
  red: 'text-destructive bg-destructive/10',
  purple: 'text-violet-400 bg-violet-400/10',
  yellow: 'text-warning bg-warning/10',
  gray: 'text-muted-foreground bg-muted',
};

export default function StatCard({ icon: Icon, label, value, sub, color = 'blue', link }) {
  const card = (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs font-medium text-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  if (link) return <Link to={link} className="block hover:opacity-90 transition-opacity">{card}</Link>;
  return card;
}