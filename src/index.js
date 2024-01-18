import express from 'express'
import logger from 'morgan'
import http from 'http'
import cors from 'cors'
import fs from 'fs/promises'
import dotenv from 'dotenv'
import { Server } from 'socket.io'

dotenv.config()

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

  socket.on('canvasUpdate', (data) => {
    console.log('canvas update')
    io.emit('Canvas', {
      nodes: data.nodes,
      edges: data.edges
    })
  })

  socket.on('reloadCanvas', () => {
    console.log('reload Canvas')
    io.emit('Canvas', {
      nodes: initialNodes,
      edges: initialEdges,
      userInfo,
      viewport: userViewports[socket.id]
    })
  })

  socket.emit('Canvas', {
    nodes: initialNodes,
    edges: initialEdges,
    userInfo,
    viewport: userViewports[socket.id]
  })

  socket.on('save', async (data) => {
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

      io.emit('canvasUpdate', {
        nodes: initialNodes,
        edges: initialEdges
      })

      await saveDataToJson()
    } else {
      console.log('No se detectaron cambios en nodos ni relaciones.')
    }
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
