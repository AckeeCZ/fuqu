import { Message, PubSub, Subscription } from '@google-cloud/pubsub'
import { FuQu } from './index'

process.env.PUBSUB_EMULATOR_HOST = 'localhost:8681'
process.env.PUBSUB_PROJECT_ID = 'fuqu'
jest.setTimeout(15 * 1e3)

describe('Emulator', () => {
  const fuQu = FuQu(PubSub, {})
  const client = new PubSub()
  test('Publish message: payload, attributes, messageId', async () => {
    const TOPIC = 'pub'
    const SUB = 'work'
    const PAYLOAD = { beers: 6 * 3, purpose: 'HO' }
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
    expect(message.id).toBe(messageId)
    subscription.removeAllListeners()
  })
  test('Receive message: payload, attributes, messageId', async () => {
    const TOPIC = 'top-topic'
    const SUB = 'top-subscription'
    const PAYLOAD = { fizzy: true }
    const ATTRIBUTES = { type: 'green' }
    let messageId: string = ''
    const { topic } = await createTopicAndSub(client, TOPIC, SUB)

    const message: Message = await new Promise(async resolve => {
      [messageId] = await topic.publishMessage({ json: PAYLOAD, attributes: ATTRIBUTES })
      const subscriber = fuQu.createSubscriber(SUB, (message: any) => {
        message.ack()
        resolve(message)
        subscriber.clear()
      })
    })
    expect(message.attributes).toMatchObject(ATTRIBUTES)
    expect(JSON.parse(message.data.toString())).toMatchObject(PAYLOAD)
    expect(message.id).toBe(messageId)
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
