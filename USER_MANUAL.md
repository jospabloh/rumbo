# Rumbo — User Manual

**Updated 2026-07-04**

Rumbo is a fleet management platform for transport operations. It provides vehicle tracking, driver management, maintenance scheduling, financial records, alert generation, and real-time messaging.

---

## Roles and Access

Rumbo uses a role-based access model. Your role determines what you can see and do.

| Role | Description |
|------|-------------|
| **Owner** | Full platform access including billing/license management and all admin functions. |
| **Admin** | Full access to all operational modules within the tenant. Cannot manage the license plan directly. |
| **Dispatcher** | Can manage drivers, vehicles, trips, fuel, fines, insurance claims, alerts, messages, and location requests. Cannot access Financial reports or Import tools. |
| **Mechanic** | Access to vehicles, maintenance records, and parts inventory only. |
| **Driver** | Access to personal trip records, own profile, fuel logs, and the driver messaging channel. Uses the Driver App interface. |

---

## Permissions Model

### Admin Capabilities

Admins have full access to every module within their tenant, including:

- View, create, edit, and delete: vehicles, drivers, trips, maintenance, parts, fuel logs, fines, insurance claims, alerts, and messages.
- Access Financial reports and cost-per-km calculations.
- Import data via CSV.
- Manage tenant settings, branding, and colors.
- Invite new users and assign roles.
- Change other users' roles (except their own).
- Configure per-role permissions for Dispatcher, Mechanic, and Driver.
- Access the Danger Zone: delegate ownership, delete the tenant.

### Member Default Permissions

Each non-admin role ships with sensible defaults, which the **admin can grant or revoke** per module and action.

**Dispatcher defaults:** Can view and operate vehicles, drivers, trips, fuel, fines, insurance, alerts, and messages. Cannot access financial reports or parts inventory.

**Mechanic defaults:** Can view and update vehicles and maintenance records, manage parts. No access to drivers, trips, financials, or messages.

**Driver defaults:** Can view own vehicle and driver record, log trips and fuel, view own fines/insurance alerts and messages. No access to financial analysis or location tracking.

**New permissions default to view-only.** When a new module or action is added to the system, every non-admin role receives it in **read-only (Ver) mode** — visible but with no create/edit/delete/pause — until the admin grants more. This means new capabilities surface for the team automatically without ever silently granting write access.

---

## How Admins Grant Access to Members

1. Go to **Admin** in the left sidebar.
2. Scroll to the **Permisos por Rol** section.
3. The **Admin** tab is shown first with every permission enabled (locked, not configurable) so you can see the full set at a glance.
4. Select a configurable role (Dispatcher, Mechanic, or Driver).
5. Toggle each module/action permission on or off.
6. Click **Guardar cambios** — permissions are saved to your tenant configuration.
7. Users with that role will see the updated access on their next login or page refresh.

**Note:** The Admin and Owner roles always have full access and are not configurable — their tabs display every permission as enabled.

---

## Interface & Appearance

### Light and dark themes

Rumbo supports both a **dark** and a **light** theme. The app opens in dark mode by default.

- Use the **theme toggle** at the bottom of the left sidebar (above **Salir**) to switch between light and dark.
- Your choice is remembered on the same browser for next time.
- **White-label branding always wins:** if your tenant has configured brand colors (Admin → Tenant information), those colors are applied on top of whichever theme is active.

### Data entry and validation

Forms across the app (vehicles, drivers, fines, fuel logs, insurance claims, maintenance, and message channels) validate your input **as you submit**, showing a message directly beneath any field that needs attention. For example:

- A vehicle requires either a plate **or** a unit number.
- A driver requires a full name; the rating must be between 0 and 5.
- A fine requires a driver, a vehicle, and an amount greater than zero.

If saving fails on the server (for example, a connection problem), the error is shown at the bottom of the form so you can retry without losing what you typed.

### Quick navigation — command palette (⌘K)

Press **⌘K** (Mac) or **Ctrl+K** (Windows/Linux) — or click **Buscar…** at the top of the sidebar — to open the command palette. Start typing to jump to any section you have access to, or to switch between light and dark themes, all from the keyboard. The palette only ever lists sections your role can open, so it stays in sync with your permissions.

### Loading and empty states

Lists (drivers, vehicles, alerts, and more) show lightweight placeholders while data loads, so the page feels instant and doesn't jump when results arrive. When a list is genuinely empty, Rumbo distinguishes between "nothing here yet" (with a shortcut to add the first record) and "no results for your search."

### Navigation: active section and "stay where you were"

- The left menu clearly highlights the section you're in (accent bar + bold label).
- Rumbo **remembers your last section** and returns you to it when you reload or reopen the app, instead of always resetting to the home screen.

### Brand colors

In **Admin → Tenant information** (and during onboarding) you can brand the app to your organization three ways:
1. **Upload your logo** and let the AI suggest a 4-color palette from it.
2. Pick one of the **premium preset palettes** with a single click.
3. Enter hex colors manually.

White-label brand colors are applied on top of whichever theme (light/dark) is active.

---

## Modules

### Dashboard

The main overview page — a command center showing:
- Fleet status: active, maintenance, inactive vehicle counts.
- Active driver count.
- Open alerts (with critical alert banner).
- Unread messages count.
- Today's collected rent income and outstanding balance.
- Fleet availability (% of units operating).
- **This month's income and expenses** (expenses combine fuel, fines, maintenance and insurance claims).
- **Open fines** (count and pending amount).
- **Maintenance due** (overdue and due-soon counts, from each record's next-service date).
- **License status** (days until renewal, color-coded by urgency).
- **Revenue trend:** a 7-day chart of collected rent income.
- Vehicle fleet table with assigned drivers.
- Recent alerts panel.

**Actionable cards & quick actions:** every KPI card links to its section (clicking "Vehículos activos" opens the vehicle catalog, etc.). Quick-action buttons at the top open the relevant **create form directly** (add vehicle, add driver, log maintenance), respecting your permissions.

**Accessible to:** Owner, Admin, Dispatcher. Roles without dashboard access (e.g. Mechanic) are taken to their first available section instead.

---

### Drivers

Manage your driver catalog.

- View all drivers with status (Active, Suspended, Inactive), phone, rating, and license number.
- Search by name or license.
- Add a new driver with personal information, license details, and photo.
- View driver detail: documents, notes, and app account linking.
- Edit or delete a driver record.

**Accessible to:** Owner, Admin, Dispatcher.

**Linking drivers to the app:** After inviting a driver (in Admin → Usuarios → Invitar), go to the driver's detail page and link their app account. This allows the driver to use the Driver App.

---

### Vehicles

Manage the vehicle fleet.

- View all vehicles with plate, make, model, year, odometer, and assigned driver.
- Search by plate, make, or model.
- Add, edit, or delete vehicles.
- View vehicle detail: documents, maintenance history, and assigned driver.

**Accessible to:** Owner, Admin, Dispatcher, Mechanic.

---

### Maintenance (Taller)

Track maintenance records and parts.

- Log maintenance events: type, cost, date, next service date.
- View pending and completed maintenance records.
- Automatic alerts when maintenance is due within 14 days.

**Parts inventory:** Track parts by name, brand, SKU, stock count, and unit cost. Set a **minimum stock** per part to get a **low-stock badge** in the list and an automatic **alert** (warning when at/below the minimum, critical when out of stock) the next time alerts are generated. Edit a part by tapping its name; adjust stock with the +/− buttons.

**Accessible to:** Owner, Admin, Mechanic.

---

### Rentas

Manage rental charges and collections per vehicle/driver.

- Generate the period's charges (daily/weekly) for active rentals.
- Register a payment against a charge (full or partial), with method and date; a charge covered by a $0 bonus counts as paid.
- See collected vs. outstanding balances, and register a manual charge.

**Accessible to:** Owner, Admin, Dispatcher.

---

### Financial (Financiero)

Manage financial records for the fleet.

**Fuel logs:** Record fuel fills by vehicle, driver, liters, and cost. See total fuel expenditure.

**Fines:** Log traffic fines by driver and vehicle, with amount, points, and payment status.

**Insurance claims:** Track accident claims by vehicle and driver, with description, amount, and status.

**Cost per km:** Server-side calculation of operating cost per kilometer driven, combining fuel, maintenance, and fines for each vehicle. Requires sufficient fuel log data with odometer readings.

**Accessible to:** Owner, Admin. Cost-per-km calculation also accessible to Dispatcher.

---

### Alerts

View and manage active fleet alerts.

- Alerts are generated automatically when documents, insurance, inspections, registrations, or maintenance are expiring within 30 days (14 days for maintenance).
- Alert severity: Critical (≤3 days), Warning (≤15 days), Info (≤30 days).
- Filter alerts by severity.
- Resolve an alert by clicking the checkmark.
- Click "Verificar ahora" to manually trigger alert generation.

**Accessible to:** Owner, Admin, Dispatcher.

---

### Messages (Mensajes)

Channel-based messaging between dispatchers and drivers.

- View and participate in broadcast channels (all team) and direct channels (one driver).
- Send text messages or voice messages (hold microphone button).
- Messages are marked as delivered and read automatically.
- Unread message count appears in the sidebar badge.

**Accessible to:** Owner, Admin, Dispatcher, and Drivers (for their own channels).

---

### Location (Ubicación)

On-demand location sharing — no continuous tracking.

- Dispatchers/admins select a vehicle and send a location request to the assigned driver.
- The driver receives a notification in their Driver App and can choose to share their location once.
- Shared locations appear on a map for the dispatcher.
- Location requests expire if not responded to.

**Accessible to:** Owner, Admin, Dispatcher (to send requests). Drivers (to respond to requests).

---

### Import (Importar)

Bulk import data via CSV files. Available types: **Drivers, Vehicles, Fuel logs, Fines, Maintenance, Parts, and Catalog lists**. The parser handles quoted fields (commas/line breaks inside quotes), escaped quotes, CRLF and BOM.

- **Templates with an example row:** each type offers a downloadable CSV template with the exact columns and a sample row marked with `#` that the importer ignores.
- **Linked records (Fuel, Fines, Maintenance):** these reference an existing vehicle and driver. The **vehicle** is matched by `placa` (or `no_unidad`); the **driver** by the `conductor` column (their license number or exact full name). If the plate/driver does not exist in your fleet, that row is flagged with an actionable error — **no phantom vehicles/drivers are created**. Import the vehicles/drivers first.
- **Per-row validation:** before importing, Rumbo splits your file into **valid rows** (previewed) and **rows with problems** (listed with their line number, reason, and how to fix it). Only valid rows are imported.
- **No duplicates:** each row is compared by its natural key against existing records and earlier rows in the same file, so re-uploading a file won't create duplicates.
- **Partial success:** rows are imported one by one — if a single row fails to save, the rest still import, and the result summarizes how many were imported, skipped, or failed (with reasons).

**Accessible to:** Owner, Admin.

---

### Lists (Listas)

Configurable value lists that populate the app's dropdowns (menu: **Configuración → Listas**). Categories include fine types, payment methods, and vehicle makes. Add, activate/deactivate, or remove values; if a tenant defines none, sensible defaults are used.

**Accessible to:** Owner, Admin.

---

### Useful Links (Enlaces útiles)

Shortcuts to your organization's external systems. Any member sees the active links; admins/owners can add (name + URL, optional description), edit, or remove them.

**Accessible to:** all staff roles.

---

### Help & Support (Ayuda)

The in-app help center.

- **Full step-by-step user manual** (searchable, accordion per module) covering every process in the app, plus keyboard shortcuts and tips.
- **Open a real support ticket** directly from the page (subject, category, priority, description). Before escalating, Rumbo **suggests a manual section** that may solve your problem. If you still need help, the case is **escalated to the support team by email** and you receive an email confirming we'll respond **within 48 business hours**. Tickets can be opened even when the license is read-only.
- **Mis solicitudes:** see your own tickets with their status (Abierto, En proceso, Resuelto, Cerrado) and the support team's replies.
- Shows the current app version.

Also reachable from **Ayuda y soporte** at the bottom of the sidebar.

**Accessible to:** all roles, including Drivers.

#### Support inbox (app owner)

The app owner has a **Soporte** dashboard (`/tickets`, under the Plataforma group) that lists support tickets across all organizations. From there they can filter by status, change a ticket's status, and reply — replies are emailed to the person who opened the ticket.

Support email recipient is configured via the `Support_email` secret (also accepts `SUPPORT_EMAIL` / `APP_OWNER_EMAIL`); if none is set it defaults to `soporte@acaciaco.com.mx`.

---

### Admin

Platform administration panel.

**Tenant information:** Edit organization name, slogan, logo URL, owner email, and brand colors. Changes to colors apply immediately across the app.

**Users:** View all users in your tenant. Change a user's role by clicking their role badge. You cannot change your own role.

**Invite users:** Enter an email address and assign a role. The user receives an invitation email. Once they log in, their account is linked to your tenant.

**Permissions by role:** Configure what Dispatcher, Mechanic, and Driver roles can do across all modules. Changes are saved to your tenant and take effect immediately.

**Danger Zone:**
- **Delegate ownership:** Transfer the tenant owner role to another user by entering their email.
- **Delete tenant:** Permanently remove the tenant and all associated data. Type `ELIMINAR` to confirm. This action cannot be undone.

**Accessible to:** Owner, Admin.

---

### My License (Mi licencia)

View your current plan, usage, and members (menu: **Configuración → Mi licencia**). Named "Mi licencia" to distinguish it from the platform-owner **Licencias** console (which manages every tenant).

- See plan type (Trial, Starter, Pro, Enterprise) and status (Active, Expired, Suspended).
- View vehicle and driver usage vs. plan limits.
- Days remaining in trial or until renewal.
- List of all team members with their roles.

**Plans available:**
- **Trial:** Dashboard, 5 Drivers, 5 Vehicles, Maintenance.
- **Starter:** All Trial features + 15 each, Financial, Messages.
- **Pro:** All Starter features + 50 each, Location, Auto-alerts, CSV Import.
- **Enterprise:** Unlimited, API access, Priority support, GitHub/Supabase integration.

Contact sales to upgrade your plan.

**Accessible to:** Owner, Admin.

---

## Driver App

Drivers access a separate simplified interface at `/driver/*`.

- **Home:** Overview of today's trips, earnings, and rating.
- **Trips:** View trip history with totals (trips, earnings, km) and **log a new trip** (platform, date, earnings, distance) for the assigned vehicle.
- **Profile:** View personal information and assigned vehicle, and **edit your own phone number**. Other fields (license, documents) are managed by an administrator.
- **Messages:** Receive and respond to messages from dispatchers.

Drivers receive location requests in the app and can respond with a single one-time location share.

---

## Tenant Setup (Onboarding)

When an admin or owner logs in for the first time without a tenant:
1. An onboarding screen appears.
2. Enter your organization name, slogan, logo URL, and brand colors.
3. Complete setup to create your tenant and access the platform.

---

## Tenant Isolation

All data in Rumbo is strictly scoped to your tenant. Users in one organization cannot see or access data from another organization. Alerts, vehicles, drivers, trips, and all operational data are always filtered to your tenant only.

---

## Security Notes

- Permissions are enforced at the database level (Row-Level Security) in addition to UI controls.
- **Routes are permission-gated.** Beyond hiding sidebar links, every route re-checks your role before rendering — opening a restricted section by typing its URL (e.g. `/financial`, `/admin`) shows an "access restricted" screen instead of the page. Drivers who reach a staff route are redirected to their own app.
- Admin users can only access data within their own tenant.
- The cost-per-km financial calculation requires at least Dispatcher-level access.
- Document expiry alerts are generated only for your tenant's drivers and vehicles.
- The Admin users list is scoped to your tenant, even for platform-level Owner accounts.
- Unread message counts on the Dashboard are filtered to your tenant.
- Messaging channels and messages are filtered to your tenant (v1.0.2).

---

## Version History

See [CHANGELOG.md](./CHANGELOG.md) for full release history.
