# Rumbo — User Manual

**Version 1.0.2 | Updated 2026-06-15**

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

## Modules

### Dashboard

The main overview page showing:
- Fleet status: active, maintenance, inactive vehicle counts.
- Active driver count.
- Open alerts (with critical alert banner).
- Unread messages count.
- Today's trips and earnings.
- Average driver rating.
- Vehicle fleet table with assigned drivers.
- Recent alerts panel.

**Accessible to:** Owner, Admin, Dispatcher.

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

**Parts inventory:** Track parts by name, SKU, stock count, and unit cost.

**Accessible to:** Owner, Admin, Mechanic.

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

Bulk import data via CSV files.

- Upload vehicle or driver data in CSV format.
- Review import results before confirming.

**Accessible to:** Owner, Admin.

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

### Billing / License (Licencia)

View your current plan, usage, and members.

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
- **Trips:** Log and view trip history.
- **Profile:** View and update personal information.
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
- Admin users can only access data within their own tenant.
- The cost-per-km financial calculation requires at least Dispatcher-level access.
- Document expiry alerts are generated only for your tenant's drivers and vehicles.
- The Admin users list is scoped to your tenant, even for platform-level Owner accounts.
- Unread message counts on the Dashboard are filtered to your tenant.
- Messaging channels and messages are filtered to your tenant (v1.0.2).

---

## Version History

See [CHANGELOG.md](./CHANGELOG.md) for full release history.
