import { FuQu } from '../index'

import test from 'ava'

const pubsubSerialMockFactory = () => {
  let handlers: any[] = []
  let messages: any[] = []
  let subscribersHooked = 0
  let consumerMutex = false
  const consume: any = async () => {
    if (messages.length === 0 || consumerMutex) return
    consumerMutex = true
    const m = messages.pop()
    for (const h of handlers) {
      await h(m)
    }
    consumerMutex = false
    return consume()
  }
  return {
    getHooked: () => subscribersHooked,
    factory: () => {
      return {
        topic: (_: string) => ({
          publishMessage: async (options: any) => {
            messages.push(options)
            consume()
            return Date.now()
          }
        }),
        subscription: (_: string) => ({
          on: (_: string, listener: (...args: any[]) => void) => {
            subscribersHooked++
            handlers.push(listener)
          },
          removeAllListeners: () => {
            handlers = []
          },
        }),
      }
    }
  }
}
const RECONNECT_TIMEOUT_MILLIS = 50
test('Does not reconnect while handling messages', async t => {
  const { factory, getHooked } = pubsubSerialMockFactory()
  const fuQu = FuQu<any, any, any>(factory, null as any, { reconnectAfterMillis: RECONNECT_TIMEOUT_MILLIS })

  const MESSAGE_COUNT = 3
  fuQu.createSubscriber('', async () => {
    await new Promise(resolve => setTimeout(resolve, RECONNECT_TIMEOUT_MILLIS))
  })
  const p = fuQu.createPublisher('')
  for (let i = 0; i < MESSAGE_COUNT; i++) {
    await p.publish({})
  }
  await new Promise(resolve => setTimeout(resolve, RECONNECT_TIMEOUT_MILLIS * MESSAGE_COUNT))
  t.is(getHooked(), 1) // initial
})

test('Does keep reconnecting when dry', async t => {
  const { factory, getHooked } = pubsubSerialMockFactory()
  const fuQu = FuQu<any, any, any>(factory, null as any, { reconnectAfterMillis: RECONNECT_TIMEOUT_MILLIS })
  const MESSAGE_COUNT = 3
  fuQu.createSubscriber('', () => {})
  const p = fuQu.createPublisher('')
  for (let i = 0; i < MESSAGE_COUNT; i++) {
    await p.publish({})
    await new Promise(resolve => setTimeout(resolve, RECONNECT_TIMEOUT_MILLIS))
  }
  t.is(getHooked(), MESSAGE_COUNT + 1) // initial + after each message
})
