# GTO Trading Corporation Leave Management System - Design Guidelines

## Design Approach

**Selected Approach:** Design System-Based (Material Design + Enterprise UI Patterns)

**Rationale:** Enterprise leave management system optimized for efficiency, clarity, and data-heavy interfaces. Prioritizes usability, accessibility, and professional aesthetic suitable for 200+ employees across organizational hierarchy.

---

## Typography System

**Font Family:**
- Primary: Inter (via Google Fonts) - exceptional readability for data-dense interfaces
- Monospace: JetBrains Mono - for employee IDs, timestamps, audit logs

**Hierarchy:**
- Page Titles: text-2xl font-semibold (Dashboard headings, section titles)
- Card/Section Headers: text-lg font-medium
- Body Text: text-base font-normal (forms, descriptions, table content)
- Labels: text-sm font-medium (form labels, metadata)
- Helper Text/Captions: text-xs (timestamps, validation messages, secondary info)
- Data Emphasis: font-semibold for PTO balances, leave counts, critical metrics

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8
- Component padding: p-4 to p-6
- Section margins: mb-6, mt-8
- Card spacing: space-y-4
- Form field gaps: gap-4
- Dashboard grid gaps: gap-6

**Grid Systems:**
- Dashboards: 12-column grid (grid-cols-12) for flexible layouts
- Cards: 3-column for overview cards (grid-cols-1 md:grid-cols-3)
- Tables: Full-width with horizontal scroll on mobile
- Forms: 2-column layout (grid-cols-1 md:grid-cols-2) for efficiency

**Container Widths:**
- Application shell: max-w-7xl mx-auto
- Forms: max-w-3xl for optimal completion
- Modals: max-w-2xl
- Data tables: w-full

---

## Component Library

### Navigation & Shell
**Top Navigation Bar:**
- Fixed header with GTO logo (left), role indicator, PTO balance chip, user dropdown (right)
- Height: h-16
- Includes notification bell icon for pending approvals/actions

**Sidebar (Desktop):**
- Width: w-64
- Collapsible on tablet (w-20 icons-only)
- Navigation items with icons from Heroicons (solid style)
- Role-based menu items with visual hierarchy

### Dashboard Components

**Stat Cards (Overview Metrics):**
- Elevated cards with shadow-sm
- Icon (top-left), metric value (large), label (below), trend indicator (optional)
- Grid layout: 3 cards for desktop, stack on mobile
- PTO Balance card: Emphasized with larger font, progress indicator

**Data Tables:**
- Striped rows for readability
- Sortable column headers with arrow indicators
- Row actions (approve/reject/view) aligned right
- Status badges: pill-shaped with subtle styling
- Pagination controls at bottom
- Fixed header on scroll for long tables

**Leave Request Cards (Alternative to tables):**
- For employee-facing views
- Card layout with employee name/photo, leave type icon, dates, status badge
- Action buttons (if applicable) at card footer

### Forms & Inputs

**Leave Application Form:**
- Two-column layout on desktop
- Label-above-input pattern
- Required field indicators (asterisk)
- Dropdown selects with search capability for departments
- Calendar date picker: inline for desktop, modal on mobile
- Auto-calculated days display (read-only field with distinct styling)
- File upload: drag-and-drop zone with preview thumbnails
- Submit button: full-width on mobile, right-aligned on desktop

**Validation & Feedback:**
- Inline error messages below fields
- Success/warning banners at form top for PTO/LWOP alerts
- Confirmation modals for critical actions (LWOP submission, rejections)

### Status Indicators

**Leave Status Badges:**
- Pill-shaped, uppercase text-xs font-medium
- Pending, Approved, Rejected, LWOP - each with distinct visual treatment
- Include icon prefix (dot or symbol)

**PTO Balance Display:**
- Prominent placement in employee header
- Format: "X/5 PTO Remaining"
- Visual progress bar beneath number
- Warning state when balance reaches 0

### Modals & Overlays

**Approval Modal (Manager View):**
- Header: Leave request summary
- Body: Full request details, employee info, file attachments
- Footer: Approve/Reject buttons with remarks textarea (mandatory for LWOP/rejection)

**LWOP Warning Modal:**
- Clear heading: "Leave Without Pay Request"
- Explanation text of PTO depletion
- Checkbox: "I understand this will be unpaid leave"
- Confirm/Cancel actions

### Reports & Analytics

**Executive Dashboard:**
- Chart cards: Bar/line charts for trends (Recharts library)
- Department comparison tables
- Time-range filters (dropdown: This Month, Quarter, Year)
- Export buttons: PDF and Excel icons with labels

**Report Generation Interface:**
- Filter panel (left sidebar or top bar)
- Preview pane (center)
- Generate button with loading state
- Download confirmation toast notification

---

## Layout Patterns by Role

**Employee Dashboard:**
- Hero section: PTO balance card (prominent)
- Quick actions: "File Leave Request" button (primary CTA)
- Leave history table/cards below
- Sidebar: Calendar view of approved leaves

**Manager Dashboard:**
- Pending approvals table (priority placement)
- Department summary cards (team PTO usage, LWOP count)
- Filter/search controls above table
- Bulk actions toolbar when multiple items selected

**HR Dashboard:**
- Multi-tab interface: Overview, All Leaves, Reports, PTO Management
- Advanced filters panel
- Export functionality prominent
- Company-wide metrics visualization

**IT Admin Panel:**
- Settings sections in accordion layout
- User management table with search/filter
- Configuration forms in modal/drawer overlays
- Audit log viewer (chronological list with filters)

---

## Responsive Behavior

**Breakpoints:**
- Mobile: < 768px - Single column, stacked cards, hamburger menu
- Tablet: 768px - 1024px - Collapsible sidebar, 2-column grids
- Desktop: > 1024px - Full layout with persistent sidebar

**Mobile Optimizations:**
- Bottom navigation bar for primary actions
- Swipe gestures for table rows (reveal actions)
- Simplified data tables (card view)
- Sticky CTA buttons

---

## Accessibility Standards

- WCAG 2.1 AA compliance
- Keyboard navigation for all interactive elements
- Focus indicators (ring-2 ring-offset-2)
- ARIA labels for icon buttons
- Screen reader announcements for status changes
- Form error associations (aria-describedby)

---

## Branding Integration

**Logo Placement:**
- Top-left of navigation bar (links to dashboard)
- Login page: Centered above form
- Report headers: Top-right corner with timestamp

**Professional Aesthetic:**
- Clean, uncluttered layouts
- Generous whitespace for readability
- Subtle shadows and borders for depth
- Enterprise-appropriate iconography (Heroicons solid/outline)

---

## Images

No hero images required - this is a functional enterprise application. All visuals are data-driven (charts, tables, user avatars).

**User Avatars:** Circular, 40px diameter in headers, 32px in tables
**Empty States:** Illustration placeholders for "No leaves filed" states (simple line art style)