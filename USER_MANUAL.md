# Rumbo — User Manual

**Version 1.0.0** · Updated 2026-06-01

---

## Table of Contents

1. [Overview](#1-overview)
2. [Roles & Permissions](#2-roles--permissions)
3. [Getting Started — Tenant Onboarding](#3-getting-started--tenant-onboarding)
4. [Dashboard](#4-dashboard)
5. [Drivers](#5-drivers)
6. [Vehicles](#6-vehicles)
7. [Maintenance](#7-maintenance)
8. [Financial Module](#8-financial-module)
9. [Alerts](#9-alerts)
10. [Location](#10-location)
11. [Messages](#11-messages)
12. [Import](#12-import)
13. [Billing & License](#13-billing--license)
14. [Administration Panel](#14-administration-panel)
15. [Driver Portal](#15-driver-portal)
16. [Recent Changes Affecting All Tenants](#16-recent-changes-affecting-all-tenants)

---

## 1. Overview

Rumbo is a multi-tenant fleet management SaaS platform. Each subscribing organization (tenant) manages its own drivers, vehicles, trips, maintenance records, finances, documents, and team members in a completely isolated environment.

**Key capabilities:**
- Full driver and vehicle lifecycle management
- Document expiry tracking with automatic alerts
- Fuel, fines, and insurance cost tracking
- Cost-per-kilometer analysis per vehicle
- Real-time location requests
- Internal team messaging (broadcast and direct channels)
- Role-based access control with per-tenant permission customization
- Custom branding per tenant (logo, colors, slogan)

---

## 2. Roles & Permissions

Rumbo uses five roles. Each tenant's **Admin** controls which actions each role can perform via the Permissions panel.

| Role | Scope | Default Access |
|---|---|---|
| **Owner** | Platform owner (one per tenant) | Full access including billing |
| **Admin** | Tenant administrator | Full access except platform-level billing |
| **Dispatcher** | Fleet operator | Dashboard, drivers, vehicles, location, messages, alerts |
| **Mechanic** | Workshop technician | Maintenance and parts inventory |
| **Driver** | Individual driver | Driver portal only (home, profile, trips, messages) |

### v1.0.0 Permission Changes (affects all tenants)

Starting in v1.0.0, the granular Permissions panel in the Admin section now **persists** settings to the tenant's license record. This is a breaking change for any configuration saved in the old UI:

- **Admin role**: always has full access to all modules (cannot be restricted).
- **Dispatcher, Mechanic, Driver**: now default to **no access** on fresh tenants. Existing tenants retain their prior UI configuration but should review and re-save settings in the Permissions panel to ensure they are persisted.

To update permissions: go to **Admin → Permisos por Rol**, select the role tab, enable the required actions per module, and click **Guardar cambios**.

---

## 3. Getting Started — Tenant Onboarding

When an **Owner** or **Admin** logs in for the first time without a linked tenant, the onboarding wizard launches automatically:

1. Enter your organization name, slogan, and logo URL.
2. Choose brand colors (hex values).
3. Select your subscription plan.
4. Complete setup — the tenant is created and you are redirected to the Dashboard.

Brand colors are applied dynamically across the entire UI for your team.

---

## 4. Dashboard

**Access:** Owner, Admin, Dispatcher

The Dashboard provides a real-time summary of your fleet:

- **KPI cards**: active vehicles, active drivers, pending alerts, open insurance claims.
- **Alert badges**: critical alerts (expiry in ≤ 3 days) are highlighted in red.
- **Quick actions**: shortcuts to register fuel, log maintenance, or view location.

---

## 5. Drivers

**Access:** Owner, Admin, Dispatcher

### Driver List
All drivers in your fleet are listed with status badges (active / suspended / inactive), license expiry, and rating.

### Add a Driver
Click **+ Nuevo conductor**. Required fields: full name. Optional: license number, expiry dates, medical certificate expiry, hire date, photo, phone.

### Driver Detail
Click any driver to open their detail panel:
- **Documents tab**: upload and manage driver documents (license, medical certificate, background check). Documents with upcoming expiry are flagged automatically.
- **Notes tab**: internal private notes visible only to admins/dispatchers.
- **Link app account**: connect the driver record to a Rumbo user account so they can access the Driver Portal. Enter their user ID in the "Perfil vinculado" field.

### Suspending / Deactivating a Driver
Change the driver's status field. Suspended drivers remain in records but are flagged visually.

---

## 6. Vehicles

**Access:** Owner, Admin, Dispatcher, Mechanic

### Vehicle List
Vehicles are listed with plate, make/model, status (active / maintenance / inactive), and insurance expiry.

### Add a Vehicle
Click **+ Nuevo vehículo**. Required field: plate number. Optional: VIN, make, model, year, assigned driver, insurance policy, expiry dates for insurance, inspection, and registration.

### Vehicle Detail
- **Documents tab**: manage vehicle documents (insurance certificate, registration, inspection report, title). Expiry dates are monitored for auto-alerts.
- **Maintenance history**: linked maintenance records for the vehicle.
- **Assign driver**: select from active drivers in your fleet.

---

## 7. Maintenance

**Access:** Owner, Admin, Mechanic

Track preventive and corrective maintenance events.

### Log Maintenance
Click **+ Mantenimiento**. Fields: vehicle, type (preventive / corrective), description, cost, date, next due date, technician, and optional photo.

### Parts Inventory
The **Parts** sub-section lists spare parts and consumables. Add, edit, or mark parts as used in maintenance records.

### Upcoming Maintenance Alerts
When a `next_due_at` date is within 14 days, the system automatically generates an alert. Alerts appear in the Alerts section with severity based on proximity.

---

## 8. Financial Module

**Access:** Owner, Admin

The Financial module has four tabs:

### Combustible (Fuel)
Log every fuel fill-up: vehicle, driver, liters, total cost, odometer reading, and optional receipt photo. The odometer readings are used to calculate cost per kilometer.

### Multas (Traffic Fines)
Record fines: vehicle, driver, fine type, amount, points, date issued, and payment status. Unpaid fines are tracked separately.

### Seguros (Insurance Claims)
Track insurance incidents: vehicle, driver, incident date, description, claimed amount, and claim status (open / approved / denied / closed).

### Costo/km (Cost per Kilometer)
Automatically calculates total operating cost divided by kilometers traveled for each vehicle, aggregating fuel, maintenance, and fine costs. Requires odometer readings in fuel logs to compute distance traveled.

> **Note:** The cost-per-km calculation is powered by a serverless function and requires at least two fuel log entries with odometer readings for each vehicle.

---

## 9. Alerts

**Access:** Owner, Admin, Dispatcher

Alerts are generated automatically by the system and can also be created manually.

### Alert Severity
| Severity | Condition |
|---|---|
| **Critical** | Expiry in ≤ 3 days |
| **Warning** | Expiry in 4–15 days |
| **Info** | Expiry in 16–30 days |

### Automatic Alert Sources
- Driver license expiry
- Driver medical certificate expiry
- Driver documents (uploaded files with expiry date)
- Vehicle insurance expiry
- Vehicle inspection expiry
- Vehicle registration expiry
- Vehicle documents (uploaded files with expiry date)
- Scheduled maintenance due dates (≤ 14 days)

### Resolving Alerts
Open an alert and click **Resolver**. Resolved alerts are archived and no longer appear in the active list. The alert count badge in the sidebar reflects unresolved critical alerts only.

### Generating Alerts Manually
From the Alerts page, use the **Generar alertas** button to trigger the alert generation function immediately (scans all docs for your tenant).

---

## 10. Location

**Access:** Owner, Admin, Dispatcher

The Location page displays a map with location request controls:

- **Request location**: send a location request to a driver's device. The driver receives the request in their portal and can share their GPS coordinates.
- **Map view**: active location data is plotted on an interactive map (React Leaflet).

> Location requests require the driver to be using the Rumbo Driver Portal on a GPS-enabled device.

---

## 11. Messages

**Access:** Owner, Admin, Dispatcher (send/receive); Driver (receive + reply in driver portal)

### Channels
Messages are organized into channels:
- **Broadcast channels**: send to all drivers or a group.
- **Direct channels**: one-to-one conversation with a specific driver.

### Creating a Channel
Click **+ Nuevo canal**, enter a channel name, and select the type (broadcast or direct). For direct channels, select the target driver.

### Sending Messages
Type in the message field and press Enter or click Send. Audio messages are supported via the microphone button.

### Unread Badges
The sidebar shows an unread count badge next to Messages when there are unread messages in any channel.

---

## 12. Import

**Access:** Owner, Admin

The Import page allows bulk data loading from CSV files.

- **Supported entities**: drivers, vehicles, trips, fuel logs.
- **CSV format**: download the template for each entity type before importing.
- **Validation**: rows with missing required fields are flagged and not imported. A summary of imported vs. skipped rows is shown after upload.

---

## 13. Billing & License

**Access:** Owner, Admin

Manage your subscription plan and tenant license:

- **Current plan**: trial / starter / pro / enterprise.
- **License limits**: maximum vehicles and drivers allowed.
- **Renewal date** and **trial end date** are displayed.
- **Upgrade**: initiate a plan upgrade via the embedded Stripe payment form.

> Trial plans expire. Ensure you upgrade before the trial end date to avoid service interruption.

---

## 14. Administration Panel

**Access:** Owner, Admin

### Tenant Information
Edit your organization name, slogan, logo URL, owner email, brand colors, and internal notes.

### User Management
View all users in your tenant. Change roles using the edit (pencil) icon next to each user. You cannot change your own role.

### Invite Users
Enter a user's email and select their role, then click **Invitar**. The user receives an invitation email. Once they accept and log in, link driver accounts to their user profile from the Drivers section.

### Permissions by Role (v1.0.0+)
Configure what each role (Admin, Dispatcher, Mechanic, Driver) can do per module:
- Select the role tab
- Toggle view / create / edit / delete / pause for each module
- Click **Guardar cambios** — settings persist to your tenant license

Admin always has full access. Other roles start with no access by default on new tenants.

### Danger Zone
- **Delegate ownership**: transfer the owner role to another user by entering their email.
- **Delete tenant**: permanently deletes the tenant record. Type `ELIMINAR` to confirm. **This action is irreversible.**

### Super Admin Panel (Owner only)
Platform owners can see and edit all tenant licenses: plan, status, limits, trial/renewal dates.

---

## 15. Driver Portal

**Access:** Driver role only

Drivers access a simplified portal at `/driver/*`:

| Route | Description |
|---|---|
| `/driver/home` | Summary: assigned vehicle, recent trips, pending alerts |
| `/driver/profile` | View and edit personal profile |
| `/driver/trips` | Log new trips, view trip history with earnings |
| `/driver/messages` | Read messages from dispatchers, reply to direct channels |

Drivers do **not** have access to the main fleet management sections. They see only data relevant to their own profile and assignments.

---

## 16. Recent Changes Affecting All Tenants

### v1.0.0 — 2026-06-01

**Security patches:**

1. **Cross-tenant document isolation (generateAlerts)**: a bug in the alert generation function caused driver and vehicle documents from *all tenants* to be scanned, regardless of the requesting tenant. This has been fixed — only documents belonging to drivers and vehicles within your tenant are now processed.

2. **Financial endpoint authorization (calculateCostPerKm)**: the cost-per-kilometer API endpoint now requires at minimum a Dispatcher role. Drivers can no longer call this endpoint directly.

**Permission system update:**

3. The Permissions panel in Admin now **saves** settings to your tenant license. Settings entered before this update were not persisted and were lost on page refresh. Please review and re-save your Permissions configuration to ensure it reflects your intended access control setup.

4. Default permissions for non-admin roles changed to **all disabled**. This only affects the Permissions panel UI defaults — existing RLS rules and sidebar visibility are unchanged. Re-configure and save your role permissions to match your operational needs.

---

*For support, contact your platform administrator or refer to the Base44 documentation.*
