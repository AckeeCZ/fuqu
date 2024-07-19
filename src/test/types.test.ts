/* eslint-disable no-empty */

import { FuQu } from '../index'
import test from 'ava'
import { PubSub } from '@google-cloud/pubsub'

test('Publish: JSON interface', async t => {
  const fuQu = FuQu(() => new PubSub())
  try {
    // any
    await fuQu.createPublisher('').publish({ json: { foo: '' } })
  } catch {}
  try {
    // ok to omit
    void fuQu.createPublisher('').publish({})
  } catch {}
  try {
    // ok
    void fuQu.createPublisher<{ foo: string }>('').publish({ json: { foo: '' } })
  } catch {}
  try {
    // @ts-expect-error (mismatch)
    void fuQu.createPublisher<{ bar: string }>('').publish({ json: { foo: '' } })
  } catch {}
  try {
    // @ts-expect-error (missing JSON)
    void fuQu.createPublisher<{ bar: string }>('').publish({})
  } catch {}
  t.pass()
})

test('Subscribe: ack / nack', async t => {
  const fuQu = FuQu(() => new PubSub())
  try {
    void fuQu.createSubscriber('', m => {
      m.ack()
      // @ts-expect-error must provide reason
      m.nack()
      // ok
      m.nack(null)
      m.nack(new Error())
      m.nack('...')
    })
  } catch {}
  t.pass()
})
