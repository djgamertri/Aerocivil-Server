import express from 'express'
import logger from 'morgan'
import http from 'http'
import cors from 'cors'
import fs from 'fs/promises'
import { Server } from 'socket.io'

const port = process.env.PORT ?? 3000
const app = express()
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*'
  }
})

let initialNodes = []
let initialEdges = []
let userInfo = {}

const userViewports = {}

const loadInitialData = async () => {
  try {
    const jsonData = await fs.readFile('./src/data.json', 'utf8')
    const data = JSON.parse(jsonData)
    initialNodes = data.initialNodes
    initialEdges = data.initialEdges
    userInfo = data.userInfo
  } catch (error) {
    console.error('Error al cargar datos iniciales desde el archivo JSON:', error)
  }
}

const saveDataToJson = async () => {
  const data = {
    initialNodes,
    initialEdges,
    userInfo
  }

  try {
    await fs.writeFile('./src/data.json', JSON.stringify(data, null, 2), 'utf8')
    console.log('Datos guardados exitosamente en data.json')
  } catch (error) {
    console.error('Error al guardar datos en el archivo JSON:', error)
  }
}

const corsOptions = {
  origin: '*',
  optionSuccessStatus: 200
}
app.use(cors(corsOptions))
app.use(logger('dev'))
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id)

  if (!userViewports[socket.id]) {
    userViewports[socket.id] = { x: 0, y: 0, zoom: 1 }
  }

  socket.emit('initialData', {
    nodes: initialNodes,
    edges: initialEdges,
    userInfo,
    viewport: userViewports[socket.id]
  })

  socket.on('canvas', (data) => {
    console.log('Evento "canvas" recibido con parámetros:', data)

    userViewports[socket.id] = data.viewport

    io.emit('canvasConfig', {
      config: data.config,
      viewport: data.viewport,
      userId: socket.id
    })
  })

  socket.on('save', async (data) => {
    if (data.viewport) {
      userViewports[socket.id] = data.viewport
      io.emit('viewportUpdated', {
        viewport: data.viewport,
        userId: socket.id
      })
    }

    const nodesChanged = JSON.stringify(data.nodes) !== JSON.stringify(initialNodes)
    const edgesChanged = JSON.stringify(data.edges) !== JSON.stringify(initialEdges)

    if (nodesChanged || edgesChanged) {
      console.log('Se detectaron cambios en nodos o relaciones. Realizar acciones necesarias.')

      if (nodesChanged) {
        initialNodes = data.nodes
      }

      if (edgesChanged) {
        initialEdges = data.edges
      }

      await saveDataToJson()

      io.emit('dataUpdated', {
        nodes: initialNodes,
        edges: initialEdges
      })
    } else {
      console.log('No se detectaron cambios en nodos ni relaciones.')
    }
  })

  socket.on('dataUpdated', (data) => {
    initialNodes = data.nodes
    initialEdges = data.edges
  })

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id)
    delete userViewports[socket.id]
  })
})

loadInitialData().then(() => {
  server.listen(port, () => {
    console.log(`Server running on port ${port}`)
  })
})
