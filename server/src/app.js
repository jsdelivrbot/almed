// @flow
import express from 'express'
import compression from 'compression'
import cors from 'cors'
import path from 'path'
import logger from 'morgan'
import bodyParser from 'body-parser'
import routes from './routes'

const app: any = express()
app.use(compression())

const whitelist = [
  'https://ohlsont.github.com/almed',
  // 'http://localhost:8080',
  // 'http://localhost:3000',
  // 'http://evil.com/',
]
const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error(`${origin} Not allowed by CORS`))
    }
  }
}
app.use(cors(corsOptions))
app.disable('x-powered-by')

// View engine setup
app.set('views', path.join(__dirname, '../views'))
app.set('view engine', 'pug')

app.use(logger('dev', {
  skip: () => app.get('env') === 'test'
}))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, '../public')))

// Routes
app.use('/', routes)

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found')
  // $FlowFixMe
  err.status = 404
  next(err)
})

// Error handler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  res
    .status(err.status || 500)
    .json({
      message: err.message
    })
})

export default app
