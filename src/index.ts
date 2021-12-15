
interface PubSubLike<MessageOptions, SubscriptionOptions> {
  topic: (name: string) => {
    publishMessage: (options: MessageOptions) => Promise<[string]>
  }
  subscription: (
    name: string,
    options?: SubscriptionOptions
  ) => {
    on: (event: string, listener: (...args: any[]) => void) => any
    removeAllListeners: () => any
  }
}
type SubscriptionOptionsLike = { batching: { maxMessages?: number } }
type PubSubLikeClass<I, MessageOptions, SubscriptionOptions> = {
  new (config: I): PubSubLike<MessageOptions, SubscriptionOptions>
}

interface MessageLike {
  ack(): void
  nack(): void
}
type ClassType<InstanceType> = { new (...args: any[]): InstanceType }

type MessageHandler<M extends MessageLike> = (message: M) => void

export const FuQu = <
  I,
  MessageOptions,
  SubscriptionOptions extends SubscriptionOptionsLike,
  Message extends MessageLike
>(
  PubSub: PubSubLikeClass<I, MessageOptions, SubscriptionOptions>,
  config: I,
  Message: ClassType<Message>,
  defaultSubscriptionOptions?: SubscriptionOptions
) => {
  const createPublisher = (topicName: string) => {
    const client = new PubSub(config)
    const topic = client.topic(topicName)
    return {
      publish: topic.publishMessage.bind(topic),
    }
  }
  const createSubscriber = (
    subscriptionName: string,
    handler: MessageHandler<Message>,
    additionalSubscriptionOptions?: SubscriptionOptions
  ) => {
    const client = new PubSub(config)
    const subscription = client.subscription(subscriptionName, Object.assign({}, defaultSubscriptionOptions, additionalSubscriptionOptions))
    subscription.on('message', handler)
    return {
      clear: () => subscription.removeAllListeners(),
    }
  }
  return {
    createPublisher,
    createSubscriber,
  }
}
