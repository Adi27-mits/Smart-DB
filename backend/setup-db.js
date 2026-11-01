/**
 * setup-db.js — Automatic database setup script
 *
 * Reads the project's college_db.sql file and executes it directly against MySQL.
 * Usage:
 *   node setup-db.js <password> [user] [host] [port]
 *
 * Example:
 *   node setup-db.js yourRootPassword
 */

const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

const password = process.argv[2]
const user = process.argv[3] || 'root'
const host = process.argv[4] || 'localhost'
const port = Number(process.argv[5]) || 3306

if (password === undefined) {
  console.log(`
❌ Error: Please provide your MySQL password.

Usage:
  node setup-db.js <password>

Example:
  node setup-db.js root
  node setup-db.js 123456
  node setup-db.js ""  (if you have no password)
`)
  process.exit(1)
}

async function setup() {
  console.log(`\n⏳ Connecting to MySQL on ${host}:${port} as user '${user}'...`)

  let connection
  try {
    // Connect without selecting database first (multipleStatements enabled to run whole SQL file)
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true,
    })
    console.log('✅ Connected to MySQL successfully!')
  } catch (err) {
    console.error(`\n❌ Failed to connect to MySQL:`, err.message)
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('👉 Tip: The password or username you provided is incorrect.')
    } else if (err.code === 'ECONNREFUSED') {
      console.error('👉 Tip: Make sure the MySQL service is running on your computer.')
    }
    process.exit(1)
  }

  const sqlPath = path.join(__dirname, '..', 'college_db.sql')
  console.log(`📖 Reading SQL file from: ${sqlPath}`)

  try {
    const sqlContent = fs.readFileSync(sqlPath, 'utf8')
    console.log(`⚡ Executing SQL statements to create 'college_db' and tables...`)

    await connection.query(sqlContent)

    console.log(`
🎉 SUCCESS! Database 'college_db' has been created and populated!
------------------------------------------------------------------
Created Tables:
  1. department          (Parent table)
  2. student             (Foreign key -> department)
  3. instructor          (Foreign key -> department)
  4. course              (Foreign key -> department)
  5. enrollment          (Bridge -> student & course)
  6. course_instructor   (Many-to-Many -> course & instructor)
  7. address             (1-to-1 -> student)

Now open http://localhost:3000 and connect with:
  • Database Name: college_db
  • Username: ${user}
  • Password: (your password)
------------------------------------------------------------------
`)
  } catch (err) {
    console.error(`\n❌ Error running SQL script:`, err.message)
  } finally {
    if (connection) await connection.end()
  }
}

setup()
