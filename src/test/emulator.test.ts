import { Message, PubSub } from '@google-cloud/pubsub'
import { FuQu } from '../index'
import test from 'ava'

process.env.PUBSUB_EMULATOR_HOST = 'localhost:8681'
process.env.PUBSUB_PROJECT_ID = 'fuqu'

const fuQu = FuQu(() => new PubSub(), Message)
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
    const subscriber = fuQu.createSubscriber(SUB, message => {
      message.ack()
      resolve(message)
      subscriber.clear()
    })
  })
  t.like(message.attributes, ATTRIBUTES)
  t.like(JSON.parse(message.data.toString()), PAYLOAD)
  t.is(messageId, message.id)
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
