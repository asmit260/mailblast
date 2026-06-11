# BULKMAILER V3 — INK DESIGN SYSTEM PRD

> A premium, minimal, editorial-inspired bulk email platform focused on clarity, trust, and workflow efficiency.

---

# 1. Product Overview

## Product Name

**BulkMailer**

## Design System

**Ink**

## Version

**3.0**

## Vision

BulkMailer should feel like professional desktop software rather than a modern startup dashboard.

The product should prioritize:

* Clarity
* Trust
* Speed
* Workflow progression
* Information density
* Professionalism

Users should feel like they are using a premium productivity application built for serious work.

---

# 2. Design Philosophy

## Core Principles

### Quiet Interface

Reduce visual noise.

Every element should have a purpose.

Use whitespace intentionally.

---

### Workflow First

Guide users through a clear process:

```text
Setup → Audience → Compose → Review → Send
```

Every screen should support the current task.

---

### Timeless Design

Avoid trends that age quickly.

Avoid:

* Glassmorphism
* Cyberpunk themes
* Neon colors
* Hacker aesthetics
* Excessive gradients
* Floating cards
* Over-animated interfaces

Prefer:

* Editorial design
* Desktop software aesthetics
* Minimal layouts
* Paper-inspired surfaces

---

### Confidence Through Simplicity

The interface should make users feel:

* In control
* Organized
* Confident
* Efficient

---

# 3. Visual Identity

## Theme Name

**Ink**

Inspired by:

* Paper
* Printed reports
* Professional writing tools
* Editorial layouts
* Productivity software

Examples of inspiration:

* Notion
* Linear
* Raycast
* Apple Notes
* Modern macOS applications

---

# 4. Color System

## Background

```css
--bg-primary: #F7F7F5;
--bg-secondary: #F2F2EF;
--surface: #FFFFFF;
```

---

## Text

```css
--text-primary: #111111;
--text-secondary: #5F5F5F;
--text-muted: #9A9A9A;
```

---

## Borders

```css
--border: #E5E5E5;
```

---

## Status Colors

### Success

```css
#1F7A3D
```

### Warning

```css
#A66B00
```

### Danger

```css
#B3261E
```

### Information

```css
#005FCC
```

---

# 5. Typography

## Headings

Primary:

```text
Instrument Serif
```

Fallback:

```text
Libre Baskerville
Georgia
```

---

## Body

Primary:

```text
Inter
```

Fallback:

```text
IBM Plex Sans
System UI
```

---

## Monospace

Primary:

```text
JetBrains Mono
```

Used for:

* SMTP data
* Statistics
* Email counts
* Logs
* Technical information

---

# 6. Texture & Background

## Paper Grain

Apply subtle paper texture globally.

Requirements:

```css
opacity: 0.02 - 0.04;
```

Should remain almost invisible.

Only noticeable on large surfaces.

---

## Ink Details

Use minimal hand-drawn accents.

Allowed:

* Section dividers
* Active navigation indicators
* Empty state illustrations

Avoid decorative overuse.

---

# 7. Application Layout

## Max Width

```css
1440px
```

---

## Structure

```text
┌─────────────────────────────┐
│ Top Navigation              │
├─────────────────────────────┤
│ Workflow Navigation         │
├─────────────────────────────┤
│ Main Workspace              │
├─────────────────────────────┤
│ Footer Actions              │
└─────────────────────────────┘
```

---

# 8. Top Navigation

## Height

```css
64px
```

---

## Content

Left:

* Logo
* Product Name

Center:

* Campaign Name

Right:

* Save Status
* SMTP Status
* User Menu

---

Example

```text
BulkMailer

Summer Campaign

Saved 2 minutes ago

● SMTP Connected
```

---

# 9. Workflow Navigation

Horizontal workflow indicator.

```text
Setup
Audience
Compose
Review
Send
```

---

## Active Step

* Black text
* Ink underline

---

## Completed Step

* Checkmark icon
* Muted appearance

---

## Future Step

* Light gray text

---

# 10. SMTP Setup Screen

## Goal

Allow users to configure outbound SMTP settings.

---

## Layout

Two-column layout.

---

### Left Panel

SMTP Configuration

Fields:

* SMTP Host
* SMTP Port
* Username
* Password
* Encryption Type
* From Name
* From Email

---

### Right Panel

Connection Status

Display:

* Current Status
* SMTP Provider
* Encryption
* Last Verification
* Connection Health

---

## Primary Action

```text
Test Connection
```

---

## Success State

```text
SMTP Connected

Last Verified:
10:42 AM

Encryption:
TLS Enabled
```

---

# 11. Audience Screen

## Goal

Import and validate recipient lists.

---

## Layout

Two-panel workspace.

---

### Left Panel

Import Methods

```text
Upload CSV

Upload XLSX

Paste Emails

Import Existing List
```

---

### Right Panel

Recipient Preview

Display:

* Email Address
* Validation Status
* Search
* Filtering

---

## Statistics

```text
Total Recipients

Valid Emails

Invalid Emails

Duplicates Removed

Estimated Send Time
```

---

## Empty State

```text
No recipients imported.

Upload a CSV file or paste email addresses to continue.
```

---

# 12. Compose Screen

## Goal

Create email content.

---

## Header

Fields:

```text
Subject

Preview Text
```

---

## Content Editor

Tabs:

```text
Design

HTML

Preview
```

---

Requirements:

* Writing-focused
* Clean interface
* Minimal distractions
* Fast editing experience

---

## Attachments

Display:

```text
invoice.pdf

banner.jpg

pricing-sheet.pdf
```

Show:

* File Name
* Size
* Remove Action

---

## Live Preview

Persistent side panel.

Modes:

```text
Desktop

Mobile
```

---

# 13. Review Screen

## Goal

Validate campaign before sending.

---

## Sections

### Campaign Information

* Subject
* Preview Text

### Audience Summary

* Total Recipients
* Valid Recipients

### SMTP Information

* Provider
* Status

### Attachments

* File Count
* Total Size

### Delivery Estimates

* Estimated Duration
* Send Rate

---

## Warnings

Display prominently:

* Missing Subject
* Invalid Recipients
* Attachment Limits
* SMTP Restrictions

---

# 14. Send Screen

## Goal

Launch campaign confidently.

---

Centered Layout

```text
Campaign Ready
```

Display:

```text
1450 Recipients

2 Attachments

SMTP Verified

Estimated Duration: 4 Minutes
```

---

## Primary CTA

```text
Send Campaign
```

---

## Secondary CTA

```text
Save Draft
```

---

# 15. Sending Experience

## Goal

Provide confidence without overwhelming users.

---

Display:

```text
863 / 1450 Sent
```

---

Metrics:

* Delivered
* Remaining
* Failed
* Sending Rate
* Elapsed Time

---

## Progress Bar

Simple and elegant.

Example:

```text
━━━━━━━━━━━━━━━━━━━━━━━──────
```

No flashy effects.

---

## Optional Activity Feed

Examples:

```text
SMTP Connected

Message Queued

Delivered Successfully

Retry Attempt

Campaign Completed
```

Collapsible.

---

# 16. Completion Screen

## Title

```text
Campaign Sent
```

---

## Statistics

```text
Delivered

Failed

Success Rate

Duration

Recipients Processed
```

---

## Actions

```text
View Report

Export CSV

Download Logs

Create New Campaign
```

---

# 17. Components

## Buttons

### Primary

```css
background: #111111;
color: #FFFFFF;
```

---

### Secondary

```css
background: #FFFFFF;
border: 1px solid #E5E5E5;
```

---

### Danger

```css
color: #B3261E;
border: 1px solid #B3261E;
```

---

## Button Specs

```css
height: 44px;
border-radius: 8px;
```

---

# 18. Cards

```css
border-radius: 10px;
border: 1px solid #E5E5E5;

box-shadow:
0 1px 2px rgba(0,0,0,.04);
```

---

No heavy shadows.

No floating appearance.

---

# 19. Animations

## Allowed

* Fade transitions
* Hover states
* Progress updates
* Skeleton loading
* Tab transitions

---

## Avoid

* Bounce effects
* Glow effects
* Floating cards
* Particle animations
* Excessive motion

---

# 20. Success Criteria

The redesign is successful when:

* SMTP setup takes less than 60 seconds.
* Users always understand the current workflow stage.
* Campaign status is visible at all times.
* The interface feels trustworthy and professional.
* New users can send a campaign without guidance.
* The product feels closer to premium desktop software than a marketing SaaS dashboard.

---

# Final Design Statement

BulkMailer should feel like a premium productivity application built for professionals.

The interface should combine the clarity of Notion, the polish of Linear, and the confidence of enterprise desktop software while maintaining a unique Ink-inspired visual identity built around paper, typography, and minimalism.
