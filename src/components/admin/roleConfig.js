import { Shield, Crown, Navigation, Wrench, Car, User, Handshake } from 'lucide-react';

// Role badge presentation shared by the admin user list and invite form.
export const ROLE_CONFIG = {
  owner:      { label: 'Owner',      color: 'text-warning bg-warning/10',   icon: Crown },
  admin:      { label: 'Admin',      color: 'text-primary bg-primary/10',   icon: Shield },
  dispatcher: { label: 'Dispatcher', color: 'text-success bg-success/10',   icon: Navigation },
  mechanic:   { label: 'Mecánico',   color: 'text-muted-foreground bg-secondary', icon: Wrench },
  driver:     { label: 'Conductor',  color: 'text-muted-foreground bg-secondary', icon: Car },
  investor:   { label: 'Socio',      color: 'text-muted-foreground bg-secondary', icon: Handshake },
  user:       { label: 'Usuario',    color: 'text-muted-foreground bg-secondary', icon: User },
};
