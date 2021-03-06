import express from 'express'
import path from 'path'
import axios from 'axios'
import cors from 'cors'
import bodyParser from 'body-parser'
import sockjs from 'sockjs'
import { renderToStaticNodeStream } from 'react-dom/server'
import React from 'react'

import cookieParser from 'cookie-parser'
import config from './config'
import Html from '../client/html'

const Root = () => ''

const { readFile, writeFile, unlink } = require('fs').promises

try {
  // eslint-disable-next-line import/no-unresolved
  // ;(async () => {
  //   const items = await import('../dist/assets/js/root.bundle')
  //   console.log(JSON.stringify(items))

  //   Root = (props) => <items.Root {...props} />
  //   console.log(JSON.stringify(items.Root))
  // })()
  console.log(Root)
} catch (ex) {
  console.log(' run yarn build:prod to enable ssr')
}

let connections = []

const port = process.env.PORT || 8090
const server = express()

const setHeaders = (req, res, next) => {
  res.set('x-skillcrucial-user', 'ce1971e0-6b21-4728-8efe-5369a4c49aad')
  res.set('Access-Control-Expose-Headers', 'X-SKILLCRUCIAL-USER')
  next()
}

server.use(setHeaders)

const middleware = [
  cors(),
  express.static(path.resolve(__dirname, '../dist/assets')),
  bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }),
  bodyParser.json({ limit: '50mb', extended: true }),
  cookieParser()
]

middleware.forEach((it) => server.use(it))

function ifFileExist() {
  const url = 'https://jsonplaceholder.typicode.com/users'
  const bigData = readFile(`${__dirname}/users.json`)
    .then((file) => {
      return JSON.parse(file)
    })
    .catch(async () => {
      const response = await axios(url)
        .then((res) => res.data)
      response.sort((a, b) => a.id - b.id)
      writeFile(`${__dirname}/users.json`, JSON.stringify(response), { encoding: 'utf8' })
      return response
    })
  return bigData
}

function toWriteFile(fileData) {
  writeFile(`${__dirname}/users.json`, JSON.stringify(fileData), 'utf8')
}

server.get('/api/v1/users', async (req, res) => {
  const newData = await ifFileExist()
  res.json(newData)
})

server.post('/api/v1/users', async (req, res) => {
  const newUser = req.body
  const userData = await ifFileExist()
  newUser.id = userData.length === 0 ? 1 : userData[userData.length - 1].id + 1
  toWriteFile([...userData, newUser])
  res.json({ status: 'success', id: newUser.id})
})

server.patch('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  const newUser = req.body
  const arr = await ifFileExist()
  const objId = arr.find((obj) => obj.id === +userId)
  const objId2 = { ...objId, ...newUser }
  const arr2 = arr.map((rec) => {
    return rec.id === objId2.id ? objId2 : rec
  })
  toWriteFile(arr2)
  res.json({status: 'success', id: 'userId'})
})

server.delete('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  const arr = await ifFileExist()
  const objId = arr.find((obj) => obj.id === +userId)
  const arr2 = arr.filter((rec) => rec.id !== objId.id)
  toWriteFile(arr2)
  res.json({status: 'success', id: 'userId'})
})

server.delete('/api/v1/users/', async (req, res) => {
  unlink(`${__dirname}/users.json`)
  .then(() => res.json({ status: 'success'}))
  .catch(() => res.send('No file'))
})

server.use('/api/', (req, res) => {
  res.status(404)
  res.end()
})

const [htmlStart, htmlEnd] = Html({
  body: 'separator',
  title: 'Skillcrucial - Become an IT HERO'
}).split('separator')

server.get('/', (req, res) => {
  const appStream = renderToStaticNodeStream(<Root location={req.url} context={{}} />)
  res.write(htmlStart)
  appStream.pipe(res, { end: false })
  appStream.on('end', () => {
    res.write(htmlEnd)
    res.end()
  })
})

server.get('/*', (req, res) => {
  const initialState = {
    location: req.url
  }

  return res.send(
    Html({
      body: '',
      initialState
    })
  )
})

const app = server.listen(port)

if (config.isSocketsEnabled) {
  const echo = sockjs.createServer()
  echo.on('connection', (conn) => {
    connections.push(conn)
    conn.on('data', async () => {})

    conn.on('close', () => {
      connections = connections.filter((c) => c.readyState !== 3)
    })
  })
  echo.installHandlers(app, { prefix: '/ws' })
}
console.log(`Serving at http://localhost:${port}`)
