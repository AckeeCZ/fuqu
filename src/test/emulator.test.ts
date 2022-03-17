import { Message, PubSub } from '@google-cloud/pubsub'
import { FuQu } from '../index'
import test from 'ava'
import { Logger } from '../lib/contracts/logger'

process.env.PUBSUB_EMULATOR_HOST = 'localhost:8681'
process.env.PUBSUB_PROJECT_ID = 'fuqu'

const fuQu = FuQu(() => new PubSub())
const client = new PubSub()

test('Publish message: payload, attributes, messageId', async t => {
  const TOPIC = 'pub'
  const SUB = 'work'
  const PAYLOAD = { beers: 6 * 3, purpose: 'HO', stamp: Date.now() }
  const ATTRIBUTES = { deliveryId: 'RDG10' }
  let messageId: string = ''
  const { subscription } = await createTopicAndSub(client, TOPIC, SUB)

  const publisher = fuQu.createPublisher(TOPIC)
  const message: Message = await new Promise(async resolve => {
    messageId = await publisher.publish({ json: PAYLOAD, attributes: ATTRIBUTES })
    subscription.on('message', resolve)
  })
  message.ack()
  t.like(message.attributes, ATTRIBUTES)
  t.like(JSON.parse(message.data.toString()), PAYLOAD)
  t.is(messageId, message.id)
  subscription.removeAllListeners()
})

test('Receive message: payload, attributes, messageId', async t => {
  const TOPIC = 'top-topic'
  const SUB = 'top-subscription'
  const PAYLOAD = { fizzy: true, stamp: Date.now() }
  const ATTRIBUTES = { type: 'green' }
  let messageId: string = ''
  const { topic } = await createTopicAndSub(client, TOPIC, SUB)

  const message: Message = await new Promise(async resolve => {
    // @ts-expect-error wrong types, see https://github.com/googleapis/nodejs-pubsub/pull/1441
    messageId = await topic.publishMessage({ json: PAYLOAD, attributes: ATTRIBUTES })
    const subscriber = fuQu.createSubscriber(SUB, (message: Message) => {
      message.ack()
      resolve(message)
      subscriber.clear()
    })
  })
  t.like(message.attributes, ATTRIBUTES)
  t.like(JSON.parse(message.data.toString()), PAYLOAD)
  t.is(messageId, message.id)
})

test('Logger works', async t => {
  const TOPIC = 'logopic'
  const SUB = 'logiption'
  const PAYLOAD = { logs: 2, stamp: Date.now() }
  const ATTRIBUTES = { carrier: 'boat' }
  await createTopicAndSub(client, TOPIC, SUB)

  const cache: { [k in keyof Logger<any, any, any>]?: any[] } = {}
  const store = (key: string) => (...args: any[]) => {
    cache[key as keyof Logger<any, any, any>] = args
    return cache
  }
  const OPTIONS = {
    logger: {
      publishedMessage: store('publishedMessage'),
      ackMessage: store('ackMessage'),
      initializedPublisher: store('initializedPublisher'),
      initializedSubscriber: store('initializedSubscriber'),
      nackMessage: store('nackMessage'),
      receivedMessage: store('receivedMessage'),
      subscriberReconnected: store('subscriberReconnected'),
    },
    reconnectAfterMillis: 250
  }
  const fuQu = FuQu(() => new PubSub(), OPTIONS)

  const promises: any = {}
  const resolves: any = {}
  const awaitId = (id: string) => {
    if (!promises[id]) {
      promises[id] = new Promise(resolve => { resolves[id] = resolve })
    }
    return promises[id]
  }
  const received = (id: string) => {
    if (resolves[id]) {
      return resolves[id]()
    } else {
      promises[id] = Promise.resolve()
    }
  }

  const publisher = fuQu.createPublisher(TOPIC)
  t.deepEqual(cache.initializedPublisher, [TOPIC])
  
  await publisher.publish({ json: PAYLOAD, attributes: ATTRIBUTES })
  t.deepEqual(cache.publishedMessage, [TOPIC, { json: PAYLOAD, attributes: ATTRIBUTES }])

  let alwaysAck = false
  fuQu.createSubscriber(SUB, async m => {
    if (alwaysAck) {
      m.ack()
    } else {
      JSON.parse(m.data.toString()).ok == false ? m.nack() : m.ack()
    }
    await received(m.id)
  }, { ackDeadline: 42 })
  t.deepEqual(cache.initializedSubscriber, [SUB, Object.assign(OPTIONS, { ackDeadline: 42 })])

  const okId = await publisher.publish({ json: { ok: true } })
  t.is(cache.publishedMessage?.[1].json.ok, true)
  await awaitId(okId)
  t.like(cache.receivedMessage?.[1], { id: okId })
  t.like(cache.ackMessage?.[1], { id: okId })
  
  const nokId = await publisher.publish({ json: { ok: false } })
  t.is(cache.publishedMessage?.[1].json.ok, false)
  await awaitId(nokId)
  t.like(cache.receivedMessage?.[1], { id: nokId })
  t.like(cache.nackMessage?.[1], { id: nokId })
  t.is(cache.subscriberReconnected, undefined)
  alwaysAck = true
  await new Promise(resolve => setTimeout(resolve, OPTIONS.reconnectAfterMillis * 2))
  t.deepEqual(cache.subscriberReconnected, [SUB, Object.assign(OPTIONS, { ackDeadline: 42 })])
})

const createTopicAndSub = async (
  client: PubSub,
  topicName: string,
  subName: string
) => {
  await client.topic(topicName).delete().catch((err) => {
    if (err.code !== 5) {
      throw err
    }
  })
  await client
    .subscription(subName)
    .delete()
    .catch(() => {})
  const [topic] = await client.createTopic(topicName)
  const [subscription] = await topic.createSubscription(subName)
  return { topic, subscription }
}
