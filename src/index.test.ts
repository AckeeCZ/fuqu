import { Message, PubSub, Subscription } from '@google-cloud/pubsub'
import { FuQu } from './index'

process.env.PUBSUB_EMULATOR_HOST = 'localhost:8681'
process.env.PUBSUB_PROJECT_ID = 'fuqu'
jest.setTimeout(15 * 1e3)

describe('Emulator', () => {
  const fuQu = FuQu(() => new PubSub(), Message)
  const client = new PubSub()
  test('Publish message: payload, attributes, messageId', async () => {
    const TOPIC = 'pub'
    const SUB = 'work'
    const PAYLOAD = { beers: 6 * 3, purpose: 'HO', stamp: Date.now() }
    const ATTRIBUTES = { deliveryId: 'RDG10' }
    let messageId: string = ''
    const { subscription } = await createTopicAndSub(client, TOPIC, SUB)

    const publisher = fuQu.createPublisher(TOPIC)
    const message: Message = await new Promise(async resolve => {
      [messageId] = await publisher.publish({ json: PAYLOAD, attributes: ATTRIBUTES })
      subscription.on('message', resolve)
    })
    message.ack()
    expect(message.attributes).toMatchObject(ATTRIBUTES)
    expect(JSON.parse(message.data.toString())).toMatchObject(PAYLOAD)
    expect(messageId).toBeTruthy() // ids not safely comparable on emulator
    subscription.removeAllListeners()
  })
  test('Receive message: payload, attributes, messageId', async () => {
    const TOPIC = 'top-topic'
    const SUB = 'top-subscription'
    const PAYLOAD = { fizzy: true, stamp: Date.now() }
    const ATTRIBUTES = { type: 'green' }
    let messageId: string = ''
    const { topic } = await createTopicAndSub(client, TOPIC, SUB)

    const message: Message = await new Promise(async resolve => {
      [messageId] = await topic.publishMessage({ json: PAYLOAD, attributes: ATTRIBUTES })
      const subscriber = fuQu.createSubscriber(SUB, message => {
        message.ack()
        resolve(message)
        subscriber.clear()
      })
    })
    expect(message.attributes).toMatchObject(ATTRIBUTES)
    expect(JSON.parse(message.data.toString())).toMatchObject(PAYLOAD)
    expect(messageId).toBeTruthy() // ids not safely comparable on emulator
  })
})

describe('Options', () => {
  let lastOptions: any = null
  const pubsubMock = {
    topic: null as any,
    subscription: (_: any, options?: any) => {
      lastOptions = options
      return {
        on: (event: string, listener: (...args: any[]) => void) => {},
        removeAllListeners: () => {},
      }
    },
  }
  const fuQu = FuQu<unknown, any, any>(() => pubsubMock, null as any, {
    foo: 'default',
  })
  test('Subscription called with default options', () => {
    fuQu.createSubscriber('', () => {})
    expect(lastOptions.foo).toBe('default')
    lastOptions = null
  })
  test('Default options get merged with additional', () => {
    fuQu.createSubscriber('', () => {}, { bar: 'op' })
    expect(lastOptions.foo).toBe('default')
    expect(lastOptions.bar).toBe('op')
    lastOptions = null
  })
  test('Additional options override default', () => {
    fuQu.createSubscriber('', () => {}, { foo: 'non-default' })
    expect(lastOptions.foo).toBe('non-default')
    lastOptions = null
  })
})

const createTopicAndSub = async (
  client: PubSub,
  topicName: string,
  subName: string
) => {
  await client.topic(topicName).delete(() => {})
  await client
    .subscription(subName)
    .delete()
    .catch(() => {})
  const [topic] = await client.createTopic(topicName)
  const [subscription] = await topic.createSubscription(subName)
  return { topic, subscription }
}
