/**
 * queryRoutes.js — Route definitions for /api/query/*
 */

const express = require('express')
const { handleExecuteQuery } = require('../controllers/queryController')

const router = express.Router()

router.post('/execute', handleExecuteQuery)

module.exports = router
