import { createClient } from 'next-sanity'

import { dataset, projectId } from '../env'

export const client = createClient({
  projectId,
  dataset,
  apiVersion: '2025-04-23',
  useCdn: false,
})
