import { FuQu } from '../index'
import test from 'ava'
import { PubSub } from '@google-cloud/pubsub'

test('Publish: JSON interface', async t => {
  const fuQu = FuQu(() => new PubSub())
  try {
    // any
    fuQu.createPublisher('').publish({ json: { foo: '' } })
  } catch {}
  try {
    // ok to omit
    fuQu.createPublisher('').publish({})
  } catch {}
  try {
    // ok
    fuQu.createPublisher<{ foo: string }>('').publish({ json: { foo: '' } })
  } catch {}
  try {
    // @ts-expect-error (mismatch)
    fuQu.createPublisher<{ bar: string }>('').publish({ json: { foo: '' } })
  } catch {}
  try {
    // @ts-expect-error (missing JSON)
    fuQu.createPublisher<{ bar: string }>('').publish({})
  } catch {}
  t.pass()
})
