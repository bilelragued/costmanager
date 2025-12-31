import express from 'express';
import cors from 'cors';
import db, { initializeDatabase } from './database';
import projectRoutes from './routes/projects';
import resourceRoutes from './routes/resources';
import wbsRoutes from './routes/wbs';
import costRoutes from './routes/costs';
import claimRoutes from './routes/claims';
import cashflowRoutes from './routes/cashflow';
import dashboardRoutes from './routes/dashboard';
import settingsRoutes from './routes/settings';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initializeDatabase();

// Routes
app.use('/api/projects', projectRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/wbs', wbsRoutes);
app.use('/api/costs', costRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/cashflow', cashflowRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`ConstructFlow API running on http://localhost:${PORT}`);
});
