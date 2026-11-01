/**
 * analysisRoutes.js — Route definitions for /api/analysis/*
 */

const express = require('express')
const router = express.Router()
const { handleRunAnalysis } = require('../controllers/analysisController')

// Run full rule-based analysis
router.post('/run', handleRunAnalysis)
router.get('/run', handleRunAnalysis)

module.exports = router
