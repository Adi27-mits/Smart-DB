/**
 * server.js — Entry point for the Smart Database Visualizer backend
 *
 * Sets up Express with all required middleware and mounts route handlers.
 */

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

// Load environment variables from .env before anything else
require('dotenv').config()

const databaseRoutes = require('./routes/databaseRoutes')
const schemaRoutes = require('./routes/schemaRoutes')
const dataRoutes = require('./routes/dataRoutes')
const analysisRoutes = require('./routes/analysisRoutes')
const queryRoutes = require('./routes/queryRoutes')
const errorHandler = require('./middleware/errorHandler')
const notFound = require('./middleware/notFound')

const app = express()
const PORT = process.env.PORT || 5000

// ─────────────────────────────────────────────
//  Security middleware
// ─────────────────────────────────────────────

// Helmet sets safe HTTP response headers
app.use(helmet())

// CORS — only allow requests from the frontend origin
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

// Rate limiting — 500 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests — please try again in a few minutes.',
  },
})
app.use(limiter)

// ─────────────────────────────────────────────
//  Request parsing
// ─────────────────────────────────────────────
app.use(express.json())

// ─────────────────────────────────────────────
//  Health check
// ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Smart Database Visualizer backend is running',
  })
})

// ─────────────────────────────────────────────
//  API routes
// ─────────────────────────────────────────────
app.use('/api/database', databaseRoutes)
app.use('/api/schema', schemaRoutes)
app.use('/api/data', dataRoutes)
app.use('/api/analysis', analysisRoutes)
app.use('/api/query', queryRoutes)

// ─────────────────────────────────────────────
//  Error handling (must be last)
// ─────────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

// ─────────────────────────────────────────────
//  Start server
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/api/health`)
})

module.exports = app
