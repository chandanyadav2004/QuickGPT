import express from 'express'
import 'dotenv/config'
import cors from 'cors'
import connectDB from './config/db.js'
import userRouter from './routes/userRoutes.js'
import chatRouter from './routes/chatRoute.js'
import messageRouter from './routes/messageRoutes.js'

const app = express()

await connectDB()


// middleware
app.use(cors())
app.use(express.json())

// routes

app.get('/', (req,res)=> res.send('Server is Live!'))
app.use('/api/user', userRouter);
app.use('/api/chat/',chatRouter);
app.use('/api/message',messageRouter)

const port = process.env.port || 3000

app.listen(port, () => { console.log(`Server is running on port ${port}`)})