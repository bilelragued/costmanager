import express from 'express';
import cors from 'cors';
import path from 'path';
import db, { initializeDatabase } from './database';
import { errorHandler, requestLogger } from './middleware/errorHandler';
import projectRoutes from './routes/projects';
import resourceRoutes from './routes/resources';
import wbsRoutes from './routes/wbs';
import costRoutes from './routes/costs';
import claimRoutes from './routes/claims';
import cashflowRoutes from './routes/cashflow';
import dashboardRoutes from './routes/dashboard';
import settingsRoutes from './routes/settings';
import mappingRoutes from './routes/mappings';
import revenueRoutes from './routes/revenue';
import aiAssignmentsRoutes from './routes/ai-assignments';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Initialize database
initializeDatabase();

// API Routes
app.use('/api/projects', projectRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/wbs', wbsRoutes);
app.use('/api/costs', costRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/cashflow', cashflowRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/mappings', mappingRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/ai', aiAssignmentsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
const clientBuildPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientBuildPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Global error handler (must be last)
app.use(errorHandler);

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`ConstructFlow API running on http://0.0.0.0:${PORT}`);
});
