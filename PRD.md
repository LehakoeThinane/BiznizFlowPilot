# 📄 BiznizFlowPilot – Product Requirements & System Architecture

---

## 1. 🧠 Product Definition

### 1.1 Product Name

**BiznizFlowPilot**

---

### 1.2 One-Line Definition

A system that helps small businesses automatically manage leads, follow-ups, tasks, and customer workflows so nothing is forgotten or lost.

---

### 1.3 Core Promise

> Never lose a lead, task, or customer again.

---

### 1.4 Target Users

* Small business owners (SMMEs)
* Managers of small teams (2–20 people)
* Service-based businesses (agencies, consultants, salons, etc.)

---

### 1.5 Problem Statement

SMMEs struggle with:

* Missed leads and slow response times
* Forgotten follow-ups
* Disorganized workflows (WhatsApp, email, spreadsheets)
* Lack of visibility into operations
* Too much manual admin

**Result:**

* Lost revenue
* Poor customer experience
* Owner burnout

---

### 1.6 Solution

BiznizFlowPilot provides:

* Centralized lead and task tracking
* Automated follow-ups and reminders
* Event-driven workflows
* Real-time visibility into business operations

---

## 2. 🎯 Goals & Success Metrics

### 2.1 Business Goals

* Increase lead conversion rate
* Reduce missed follow-ups
* Reduce manual admin workload
* Improve operational visibility

---

### 2.2 Product Metrics

* % of leads responded to within SLA
* Task completion rate
* Number of automated workflows triggered
* Overdue task reduction
* Daily/weekly active users

---

## 3. 🧩 Core Features (MVP)

### 3.1 Lead Management

* Capture leads (API + manual input)
* Lead pipeline tracking
* Assign leads to users

**Statuses:**

* New → Contacted → Qualified → Won → Lost

---

### 3.2 Task Management

* Manual + auto-created tasks
* Assign to users
* Due dates + priorities

**Statuses:**

* Pending → In Progress → Completed → Overdue

---

### 3.3 Automated Follow-Ups

* Trigger reminders if no activity
* Time-based automation (24h, 48h, etc.)
* Email + in-app notifications

---

### 3.4 Workflow Engine (MVP)

Rule-based automation:

> IF event → THEN action

**Examples:**

* New lead → assign + notify
* Lead idle → create follow-up task
* Task overdue → notify manager

---

### 3.5 Notifications

* Email notifications
* In-app alerts
* Triggered by events/workflows

---

### 3.6 Dashboard

* Lead overview
* Task overview
* Overdue alerts
* Workflow activity

---

## 4. 👥 User Roles

### Owner

* Full system access
* Manage workflows
* View all data

### Manager

* Assign tasks
* Monitor team
* View reports

### Staff

* View assigned leads/tasks
* Update statuses

---

## 5. ⚙️ Non-Functional Requirements

* Multi-tenant architecture
* Secure (JWT + RBAC)
* Scalable (queue-based processing)
* Observable (logs + tracking)
* API response <300ms target

---

## 6. 🏗️ System Architecture (Layered)

---

### 6.1 Presentation Layer

* React frontend
* Dashboard UI
* Forms and workflow configuration

---

### 6.2 API Layer (FastAPI)

* Request handling
* Validation
* Routing

---

### 6.3 Business Logic Layer

Handles:

* Lead lifecycle
* Task logic
* Workflow rules

---

### 6.4 Workflow Engine

Core automation system:

**Structure:**

* Trigger → Condition → Action

---

### 6.5 Event & Queue Layer

* Redis + Celery
* Async processing
* Delayed jobs
* Retries

---

### 6.6 Data Layer (PostgreSQL)

**Core entities:**

* businesses
* users
* customers
* leads
* tasks
* workflows
* events
* notifications
* logs

---

### 6.7 Integration Layer

* Email services
* Webhooks
* Future: WhatsApp / CRM

---

### 6.8 Security Layer

* JWT authentication
* Role-based access
* Tenant isolation

---

## 7. 🔁 System Flow Example

### Scenario: New Lead

1. Lead created via API
2. Stored in database
3. Event generated (`lead.created`)
4. Workflow engine evaluates rules
5. Actions triggered:

   * Assign user
   * Create task
   * Send notification
6. Async queue executes actions
7. Logs recorded
8. Dashboard updated

---

## 8. 🗄️ Database Schema (High-Level)

### Core Tables

* businesses
* users
* customers
* leads
* tasks
* workflows
* workflow_runs
* events
* notifications
* activity_logs

---

### Key Design Principles

* UUID primary keys
* JSONB for flexible fields
* Indexed queries (status, business_id, assigned_to)

---

## 9. 🔌 API Design (High-Level)

Base:

```
/api/v1
```

---

### Auth

* POST /auth/register
* POST /auth/login

---

### Users

* GET /users
* POST /users

---

### Customers

* POST /customers
* GET /customers
* PATCH /customers/{id}

---

### Leads

* POST /leads
* GET /leads
* PATCH /leads/{id}

---

### Tasks

* POST /tasks
* GET /tasks
* PATCH /tasks/{id}

---

### Workflows

* POST /workflows
* GET /workflows
* PATCH /workflows/{id}
* POST /workflows/{id}/test

---

### Dashboard

* GET /dashboard/summary

---

## 10. 🧠 Core Business Logic Rules

### Rule 1

New lead → create task + notify

### Rule 2

Lead idle → follow-up task

### Rule 3

Task overdue → notify manager

### Rule 4

Lead won → create onboarding task

---

## 11. 🧬 Backend Architecture Pattern

### Layers

* API Layer
* Service Layer
* Repository Layer
* Event Layer
* Async Worker Layer

---

### Key Services

* AuthService
* LeadService
* TaskService
* WorkflowService
* EventService
* NotificationService

---

## 12. 📁 Project Structure

```
app/
  api/
  core/
  models/
  schemas/
  repositories/
  services/
  workers/
  utils/
  main.py
```

---

## 13. 🚀 Implementation Plan

---

### Phase 1: Foundation

* FastAPI setup
* PostgreSQL + migrations
* Auth (JWT)
* Multi-tenant support

---

### Phase 2: Core CRM

* Customers
* Leads
* Tasks
* RBAC

---

### Phase 3: Event System

* Event creation
* Event processing

---

### Phase 4: Workflow Engine

* Rule evaluation
* Action execution
* Workflow logs

---

### Phase 5: Async Processing

* Celery + Redis
* Notifications
* Scheduled jobs

---

### Phase 6: Dashboard

* Aggregated metrics
* System visibility

---

## 14. 🚫 MVP Boundaries

Do NOT build yet:

* Drag-and-drop workflow UI
* AI features
* WhatsApp integration
* Billing system
* Advanced analytics

---

## 15. 💣 Final Positioning

This is not:

> "a task manager"

This is:

> **an automated operations system for small businesses**

---

## 🧠 Final Thought

If you actually build this properly, two things will happen:

1. You'll finally understand backend systems deeply
2. You'll never again introduce yourself as a "WordPress developer" without feeling slightly embarrassed

Which, honestly, is progress.
