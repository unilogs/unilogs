import express from 'express'
import dotenv from 'dotenv'
import pg, { Pool } from 'pg'

dotenv.config()

const app = express()
app.use(express.json())

const pool = new Pool()

app.get('/logs', async (req, res) => {
  const logs = await pool.query('SELECT * FROM logs')
  res.send(logs.rows)
})

app.listen(process.env.PORT || 3001, () => {
  console.log('App started listening!')
})