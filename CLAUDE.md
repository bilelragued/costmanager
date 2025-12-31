# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ConstructFlow is a construction ERP system for NZ/AU infrastructure projects. It handles tendering, project management, cost tracking, progress claims, and cashflow forecasting.

## Commands

```bash
# Install all dependencies (root, server, client)
npm run install:all

# Start development (runs both server and client concurrently)
npm run dev

# Start individual services
npm run dev:server  # Express API on http://localhost:3001
npm run dev:client  # Vite React app on http://localhost:3000

# Build
npm run build       # Builds both server and client
```

## Architecture

### Monorepo Structure
- `/server` - Express.js backend with TypeScript (tsx for dev, tsc for build)
- `/client` - React frontend with Vite + TailwindCSS

### Backend (`/server`)
- **Database**: SQLite via better-sqlite3, stored at `server/constructflow.db`
- **Schema**: Defined inline in `server/src/database.ts` - all tables created via `initializeDatabase()`
- **Routes**: Express routers in `server/src/routes/` matching API endpoints
- **API Base**: `/api` - proxied from client in dev mode

### Frontend (`/client`)
- **State**: React Query (@tanstack/react-query) for server state
- **Routing**: React Router v6 with nested routes under Layout
- **Styling**: TailwindCSS
- **Icons**: lucide-react
- **Charts**: recharts
- **API Layer**: `client/src/services/api.ts` - typed fetch wrappers

### Data Model (Core Entities)
- **Projects**: Can be `tender` (estimation) or `active` (live project)
- **WBS Items**: Hierarchical work breakdown structure with resource assignments
- **Resources**: Plant, Labour, Materials, Subcontractors (company-wide library)
- **Resource Assignments**: Link WBS items to resources with budgeted hours/quantities
- **Daily Logs**: Track actual plant hours, labour hours, materials, quantities
- **Cost Entries**: Invoice tracking for non-daily costs
- **Progress Claims**: Monthly payment claims with line items against WBS
- **Variations**: Contract change orders
- **Cashflow Rules**: Payment timing configuration for different cost types

### Key Patterns
- UUIDs for all primary keys (generated via `uuid` package)
- SQLite foreign keys enabled, cascade deletes on child records
- API returns objects directly from SQLite (no ORM)
- Client uses React Query hooks for data fetching with invalidation on mutations
- All dates stored as ISO strings

### Port Configuration
- Client: 3000 (Vite dev server)
- Server: 3001 (Express API)
- Client proxies `/api` requests to server in development
