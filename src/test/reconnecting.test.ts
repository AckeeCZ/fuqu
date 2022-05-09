import { FuQu } from '../index'

import test from 'ava'
import { SubscriptionOptionsLike } from '../lib/contracts/pubsub'


const RECONNECT_TIMEOUT_MILLIS = 50
test('Does not reconnect while handling messages', async t => {
  const pubSubMock = pubsubSerialMockFactory()
  const fuQu = FuQu(pubSubMock.factory, { reconnectAfterMillis: RECONNECT_TIMEOUT_MILLIS, batching: { maxMessages: 1 } })

  const MESSAGE_COUNT = 3
  fuQu.createSubscriber('', async m => {
    await new Promise(resolve => setTimeout(resolve, RECONNECT_TIMEOUT_MILLIS))
    m.ack()
  })
  const p = fuQu.createPublisher('')
  for (let i = 0; i < MESSAGE_COUNT; i++) {
    await p.publish({})
  }
  await new Promise(resolve => setTimeout(resolve, RECONNECT_TIMEOUT_MILLIS * MESSAGE_COUNT))
  t.is(pubSubMock.timesHooked, 1) // initial
})

test('Does not reconnect waiting for ack/nack', async t => {
  const pubSubMock = pubsubSerialMockFactory()
  const fuQu = FuQu(pubSubMock.factory, { reconnectAfterMillis: RECONNECT_TIMEOUT_MILLIS, batching: { maxMessages: 1 } })
  fuQu.createSubscriber('', () => {})
  const p = fuQu.createPublisher('')
  await p.publish({})
  await new Promise(resolve => setTimeout(resolve, RECONNECT_TIMEOUT_MILLIS * 3))
  t.is(pubSubMock.timesHooked, 1) // initial
})

test('Does keep reconnecting when dry', async t => {
  const pubSubMock = pubsubSerialMockFactory()
  const fuQu = FuQu(pubSubMock.factory, { reconnectAfterMillis: RECONNECT_TIMEOUT_MILLIS, batching: { maxMessages: 1 } })
  const MESSAGE_COUNT = 3
  fuQu.createSubscriber('', m => m.ack())
  const p = fuQu.createPublisher('')
  for (let i = 0; i < MESSAGE_COUNT; i++) {
    await p.publish({})
    await new Promise(resolve => setTimeout(resolve, RECONNECT_TIMEOUT_MILLIS))
  }
  t.is(pubSubMock.timesHooked, MESSAGE_COUNT + 1) // initial + after each message
})

const pubsubSerialMockFactory = () => {
  let handlers: any[] = []
  let messages: any[] = []
  let subscribersHooked = 0
  let consumerSemaphore = 0
  let maxConcurrentMessages = 1
  const consume: any = async () => {
    if (messages.length === 0 || consumerSemaphore === maxConcurrentMessages) return
    consumerSemaphore++
    const m = messages.pop()
    for (const h of handlers) {
      await new Promise(resolve => {
        h(Object.assign(m, { ack: resolve, nack: resolve }))
      })
    }
    consumerSemaphore--
    return consume()
  }
  return {
    get timesHooked () {
      return subscribersHooked
    },
    factory: () => {
      return {
        topic: (_: string) => ({
          publishMessage: async (options: any) => {
            messages.push(options)
            consume()
            return Date.now()
          }
        }),
        subscription: (_: string, options?: SubscriptionOptionsLike) => {
          maxConcurrentMessages = options?.batching?.maxMessages ?? 1
          return {
            on: (event: string, listener: (...args: any[]) => void) => {
              if (event !== 'message') return
              subscribersHooked++
              handlers.push(listener)
            },
            removeAllListeners: () => {
              handlers = []
            },
          }
        },
      }
    }
  }
}