// @flow
import { Router } from 'express'

import { getCollection, add, del } from './storage'
import { getEvents, getMapPoints } from './almed'

const routes: any = Router()

const dataKey = 'almedKey'
routes.get('/', async (req, res) => {
  const data = await getCollection(dataKey)
  res.json(data)
})

routes.get('/map', async (req, res) => {
  res.json(getMapPoints())
})

routes.get('/empty', async (req, res) => {
  await del(dataKey)
  res.sendStatus(200)
})
routes.get('/update', async (req, res) => {
  const allData = await getEvents()
  // await del(dataKey)
  await add(dataKey, allData)
  res.sendStatus(200)
})

export default routes
